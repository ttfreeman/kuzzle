'use strict';

const should = require('should');
const mockRequire = require('mock-require');
const { PreconditionError } = require('kuzzle-common-objects');

const KuzzleMock = require('../../mocks/kuzzle.mock');
const ClientAdapterMock = require('../../mocks/clientAdapter.mock');

const scopeEnum = require('../../../lib/core/storage/storeScopeEnum');

describe('#core/storage/StorageEngine', () => {
  let StorageEngine;
  let storageEngine;
  let kuzzle;

  before(() => {
    mockRequire('../../../lib/core/storage/clientAdapter', ClientAdapterMock);
    StorageEngine = mockRequire.reRequire('../../../lib/core/storage/storageEngine');
  });

  after(() => {
    mockRequire.stopAll();
  });

  beforeEach(() => {
    kuzzle = new KuzzleMock();

    storageEngine = new StorageEngine(kuzzle);
  });

  describe('#constructor', () => {
    it('should instantiate a client adapter per storage scope', () => {
      should(storageEngine.public).instanceOf(ClientAdapterMock);
      should(storageEngine.public.scope).eql(scopeEnum.PUBLIC);

      should(storageEngine.private).instanceOf(ClientAdapterMock);
      should(storageEngine.private.scope).eql(scopeEnum.PRIVATE);
    });
  });

  describe('#init', () => {
    it('should initialize client adapters', async () => {
      await storageEngine.init();

      should(storageEngine.public.init).calledOnce();
      should(storageEngine.private.init).calledOnce();
    });

    it('should register global storage events', async () => {
      await storageEngine.init();

      kuzzle.ask.restore();

      await kuzzle.ask('core:store:index:isValid', 'foo');
      should(storageEngine.public.client.isIndexNameValid).calledWith('foo');

      await kuzzle.ask('core:store:collection:isValid', 'bar');
      should(storageEngine.public.client.isCollectionNameValid).calledWith('bar');
    });

    it('should throw if a private index and a public one share the same name', async () => {
      storageEngine.public.listIndexes.resolves(['foo', 'bar', 'ohnoes']);
      storageEngine.private.listIndexes.resolves(['baz', 'ohnoes', 'qux']);

      return should(storageEngine.init()).rejectedWith(PreconditionError, {
        id: 'services.storage.index_already_exists',
      });
    });
  });
});