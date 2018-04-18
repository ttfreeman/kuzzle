'use strict';

const
  Promise = require('bluebird'),
  should = require('should'),
  sinon = require('sinon'),
  rewire = require('rewire'),
  SecurityController = rewire('../../../../lib/api/controllers/securityController'),
  Request = require('kuzzle-common-objects').Request,
  KuzzleMock = require('../../../mocks/kuzzle.mock'),
  sandbox = sinon.sandbox.create();

describe('Test: security controller - createFirstAdmin', () => {
  let
    adminController,
    kuzzle;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    adminController = new SecurityController(kuzzle);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#createFirstAdmin', () => {
    let
      reset,
      resetRolesStub,
      resetProfilesStub,
      createUser;

    beforeEach(() => {
      reset = SecurityController.__set__({
        resetRoles: sandbox.stub().returns(Promise.resolve()),
        resetProfiles: sandbox.stub().returns(Promise.resolve())
      });
      resetRolesStub = SecurityController.__get__('resetRoles');
      resetProfilesStub = SecurityController.__get__('resetProfiles');
      createUser = sandbox.stub().returns(Promise.resolve());

      adminController.createUser = createUser;
    });

    afterEach(() => {
      reset();
    });

    it('should do nothing if admin already exists', () => {
      kuzzle.funnel.controllers.server.adminExists = sandbox.stub().returns(Promise.resolve({exists: true}));

      return should(adminController.createFirstAdmin(new Request({
        controller: 'security',
        action: 'createFirstAdmin',
        _id: 'toto',
        body: {content: {password: 'pwd'}}
      }), {})).be.rejected();
    });

    it('should create the admin user and not reset roles & profiles if not asked to', () => {
      kuzzle.funnel.controllers.server.adminExists = sandbox.stub().returns(Promise.resolve({exists: false}));
      kuzzle.repositories.user.load = sandbox.stub().returns(Promise.resolve(kuzzle.repositories.user.anonymous()));

      return adminController.createFirstAdmin(new Request({
        controller: 'security',
        action: 'createFirstAdmin',
        _id: 'toto',
        body: {content: {password: 'pwd'}}
      }))
        .then(() => {
          should(createUser).be.calledOnce();
          should(createUser.firstCall.args[0]).be.instanceOf(Request);
          should(resetRolesStub).have.callCount(0);
          should(resetProfilesStub).have.callCount(0);
        });
    });

    it('should create the admin user and reset roles & profiles if asked to', () => {
      kuzzle.funnel.controllers.server.adminExists = sandbox.stub().returns(Promise.resolve({exists: false}));
      kuzzle.repositories.user.load = sandbox.stub().returns(Promise.resolve(kuzzle.repositories.user.anonymous()));

      kuzzle.funnel.controllers.index = {
        refreshInternal: sandbox.stub().returns(Promise.resolve({}))
      };

      return adminController.createFirstAdmin(new Request({
        controller: 'security',
        action: 'createFirstAdmin',
        _id: 'toto',
        body: {content: {password: 'pwd'}},
        reset: true
      }))
        .then(() => {
          should(createUser).be.calledOnce();
          should(createUser.firstCall.args[0]).be.instanceOf(Request);
          should(resetRolesStub).have.callCount(1);
          should(resetProfilesStub).have.callCount(1);
        });
    });
  });

  describe('#resetRoles', () => {
    it('should call fromDTO and validateAndSaveRole with all default roles', () => {
      const
        roleRepository = {
          fromDTO: role => Promise.resolve(role),
          validateAndSaveRole: sandbox.stub().returns(Promise.resolve())
        },
        fromDTOSpy = sinon.spy(roleRepository, 'fromDTO'),
        mock = {
          admin: {
            controllers: {
              foo: {
                actions: {
                  bar: true
                }
              }
            }
          },
          default: {
            controllers: {
              baz: {
                actions: {
                  yolo: true
                }
              }
            }
          },
          anonymous: {
            controllers: {
              anon: {
                actions: {
                  ymous: true
                }
              }
            }
          }
        };

      return SecurityController.__get__('resetRoles')(mock, roleRepository)
        .then(() => {
          should(fromDTOSpy).have.callCount(3);
          should(roleRepository.validateAndSaveRole).have.callCount(3);

          should(fromDTOSpy.firstCall).be.calledWithMatch({_id: 'admin', controllers: {foo: {actions: {bar: true}}}});
          should(roleRepository.validateAndSaveRole.firstCall).be.calledWithMatch({_id: 'admin', controllers: {foo: {actions: {bar: true}}}});

          should(fromDTOSpy.secondCall).be.calledWithMatch({_id: 'default', controllers: {baz: {actions: {yolo: true}}}});
          should(roleRepository.validateAndSaveRole.secondCall).be.calledWithMatch({_id: 'default', controllers: {baz: {actions: {yolo: true}}}});

          should(fromDTOSpy.thirdCall).be.calledWithMatch({_id: 'anonymous', controllers: {anon: {actions: {ymous: true}}}});
          should(roleRepository.validateAndSaveRole.thirdCall).be.calledWithMatch({_id: 'anonymous', controllers: {anon: {actions: {ymous: true}}}});
        });
    });
  });

  describe('#resetProfiles', () => {
    it('should call fromDTO and validateAndSaveProfile with all default profiles and rights policies', () => {
      const
        profileRepository = {
          fromDTO: profile => Promise.resolve(profile),
          validateAndSaveProfile: sandbox.stub().returns(Promise.resolve())
        },
        fromDTOSpy = sinon.spy(profileRepository, 'fromDTO');

      return SecurityController.__get__('resetProfiles')(profileRepository)
        .then(() => {
          should(fromDTOSpy).have.callCount(3);
          should(profileRepository.validateAndSaveProfile).have.callCount(3);

          should(fromDTOSpy.firstCall).be.calledWithMatch({
            _id: 'admin',
            policies: [{roleId: 'admin'}]
          });
          should(profileRepository.validateAndSaveProfile.firstCall).be.calledWithMatch({
            _id: 'admin',
            policies: [{roleId: 'admin'}]
          });

          should(fromDTOSpy.secondCall).be.calledWithMatch({
            _id: 'default',
            policies: [{roleId: 'default'}]
          });
          should(profileRepository.validateAndSaveProfile.secondCall).be.calledWithMatch({
            _id: 'default',
            policies: [{roleId: 'default'}]
          });

          should(fromDTOSpy.thirdCall).be.calledWithMatch({
            _id: 'anonymous',
            policies: [{roleId: 'anonymous'}]
          });
          should(profileRepository.validateAndSaveProfile.thirdCall).be.calledWithMatch({
            _id: 'anonymous',
            policies: [{roleId: 'anonymous'}]
          });
        });
    });
  });
});
