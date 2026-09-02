import { TestBed } from '@angular/core/testing';
import { describe, expect, it, beforeEach } from 'vitest';
import { JoinRequestsStore } from './join-requests-store';
import { ToastService } from '../toast';
import { Session } from '../auth';

describe('JoinRequestsStore', () => {
  let store: JoinRequestsStore;
  let toastMock: { success: any; error: any; info: any };
  let sessionMock: { user: any };

  beforeEach(() => {
    toastMock = {
      success: () => {},
      error: () => {},
      info: () => {},
    };

    sessionMock = {
      user: () => ({
        userId: 'usr-tester',
        displayName: 'Tester#EUW',
      }),
    };

    TestBed.configureTestingModule({
      providers: [
        JoinRequestsStore,
        { provide: ToastService, useValue: toastMock },
        { provide: Session, useValue: sessionMock },
      ],
    });

    store = TestBed.inject(JoinRequestsStore);
  });

  it('should initialize with initial requests', () => {
    expect(store.myRequests().length).toBe(3);
    expect(store.pendingMyRequestsCount()).toBe(3);
  });

  it('should send a new join request and update signal', async () => {
    const initialCount = store.myRequests().length;
    await store.sendJoinRequest({
      id: 'grp-test-99',
      name: 'Test New Group',
      tag: 'NEW',
      region: 'EUW',
    });

    expect(store.myRequests().length).toBe(initialCount + 1);
    expect(store.myRequests()[0].groupName).toBe('Test New Group');
    expect(store.myRequests()[0].status).toBe('PENDING');
  });

  it('should cancel an existing join request', async () => {
    const target = store.myRequests()[0];
    await store.cancelJoinRequest(target.id);
    expect(store.myRequests().some((r) => r.id === target.id)).toBe(false);
  });

  it('should load group requests and allow accepting/declining', async () => {
    await store.loadGroupRequests('lan-challenger');
    expect(store.groupRequests().length).toBe(2);

    const firstReqId = store.groupRequests()[0].id;
    await store.acceptJoinRequest('lan-challenger', firstReqId);
    expect(store.groupRequests().some((r) => r.id === firstReqId)).toBe(false);

    const secondReqId = store.groupRequests()[0].id;
    await store.declineJoinRequest('lan-challenger', secondReqId);
    expect(store.groupRequests().length).toBe(0);
  });
});
