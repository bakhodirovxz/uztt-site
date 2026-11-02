import { assignReferees, AsgMatch, AsgReferee } from './assignment.engine';

const m = (id: string, o: Partial<AsgMatch> = {}): AsgMatch => ({
  id,
  stage: 'SEMIFINAL',
  scheduledAt: null,
  tableNumber: 1,
  playerIds: ['p1', 'p2'],
  playerRegions: [null, null],
  refereeUserId: null,
  assistantUserId: null,
  locked: false,
  ...o,
});
const r = (userId: string, o: Partial<AsgReferee> = {}): AsgReferee => ({
  userId,
  region: null,
  category: 'FIRST',
  ownPlayerId: null,
  ...o,
});

describe('assignReferees: juftligi aniq bo‘lmagan o‘yinlar', () => {
  it('o‘yinchisi null o‘yinga hakam tayinlanmaydi (hakam-o‘yinchi keyin o‘z o‘yiniga tushmasin)', () => {
    const res = assignReferees(
      [
        m('known'),
        m('tbd1', { playerIds: ['p3', null] }),
        m('tbd2', { playerIds: [null, null] }),
      ],
      [r('u1', { ownPlayerId: 'p9' }), r('u2')],
      { needAssistant: false },
    );
    expect(res.map((x) => x.matchId)).toEqual(['known']);
    expect(res[0].refereeUserId).toBeTruthy();
  });
});
