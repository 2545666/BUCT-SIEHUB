import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultSievoxPortalView, getSievoxPortalRole, resolveSievoxPortalView } from './sievoxPortal.js';

const access = level => [{ moduleId: 'sievox', organization: 'student_union', department: 'student_rights', accessLevel: level }];
const users = {
  student: { role: 'student', memberRole: 'student' },
  volunteer: { role: 'admin', memberRole: 'volunteer', positionTitle: 'volunteer', moduleCapabilities: access('member') },
  lead: { role: 'superadmin', memberRole: 'department_lead', positionTitle: 'department_head', moduleCapabilities: access('manage') },
  presidium: { role: 'superadmin', memberRole: 'presidium', positionTitle: 'presidium_member', moduleCapabilities: access('manage') },
  ultimate: { role: 'superadmin', isUltimateAdmin: true }
};

test('five SIEVOX identities enter their authorized portal', () => {
  assert.deepEqual(Object.fromEntries(Object.entries(users).map(([name, user]) => [name, [getSievoxPortalRole(user), defaultSievoxPortalView(user)]])), {
    student: ['student', 'student'], volunteer: ['volunteer', 'admin'], lead: ['lead', 'superadmin'], presidium: ['presidium', 'superadmin'], ultimate: ['ultimate', 'superadmin']
  });
});

test('manager can view own feedback, but student and volunteer cannot open privileged portal', () => {
  assert.equal(resolveSievoxPortalView(users.volunteer, 'student'), 'student');
  assert.equal(resolveSievoxPortalView(users.volunteer, 'superadmin'), 'admin');
  assert.equal(resolveSievoxPortalView(users.student, 'admin'), 'student');
  assert.equal(resolveSievoxPortalView(users.ultimate, 'admin'), 'admin');
  assert.equal(resolveSievoxPortalView({ ...users.volunteer, moduleCapabilities: access('student') }, 'admin'), 'student');
});
