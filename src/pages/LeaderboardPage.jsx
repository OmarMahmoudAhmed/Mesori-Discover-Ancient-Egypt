/*
 * =====================================================
 * LeaderboardPage.jsx - قائمة المتصدرين
 * =====================================================
 *
 * تعرض ترتيب جميع اللاعبين حسب النقاط.
 * المستخدم الحالي (isCurrentUser: true) يُبرز بلون أخضر.
 *
 * ⬅️ إصلاح صف الرأس (شعار + عنوان + شخصية): flex-shrink-0 على
 *   الشعار والشخصية + min-w-0 على العنوان الأوسط — راجع تعليقات
 *   التصحيح القديمة لو حبيت التفاصيل الكاملة لسبب "الميلان لليسار".
 *
 * ⬅️ تأثير تغيّر الترتيب — مرتبط بقاعدة البيانات فعلياً بطريقتين:
 *
 *   1) عند فتح الصفحة: نقارن ترتيبك الحالي بآخر ترتيب معروف محفوظ
 *      محلياً (localStorage عبر rankTracking.js) — بيغطي "مين
 *      عدّاك من آخر مرة دخلت فيها" حتى لو قفلت التطبيق كامل بين
 *      الزيارتين. النتيجة تتحوّل لشارة صغيرة دائمة (RankChangeBadge)
 *      جنب رقم ترتيبك.
 *
 *   2) وانت واقف في الصفحة فعلياً: اشتراك Supabase Realtime على
 *      جدول leaderboard_stats (مش profiles مباشرة، ولا leaderboard
 *      view — الاتنين مايصلحوش للاشتراك: الأول RLS بتاعه (auth.uid
 *      ()=id) هيخلّي كل حد يستقبل تغييرات صفّه بس، والتاني view
 *      مالوش أي WAL خاص بيه أصلاً. leaderboard_stats جدول حقيقي
 *      ضيّق بس بالأعمدة العلنية أصلاً في الـ view، وقابل للقراءة
 *      من الجميع ومسجّل في publication الـ Realtime — تفاصيل
 *      القرار والتحقق منه على المشروع الحي في migration
 *      010_leaderboard_realtime_stats.sql). أي تغيير هناك (نقاط أي
 *      حد، مش بس أنت) بيرجّعنا نجيب الليدربورد كامل تاني، ونقارن
 *      ترتيبك الجديد بآخر حالة معروضة فعلياً في نفس الجلسة — ده
 *      اللي بيدّي "ايفيكت لحظي" حقيقي (RankChangeToast) وقتها
 *      بالظبط، مش لما تفتح الصفحة بس.
 *
 *   في الحالتين: أخضر لو رقم ترتيبك قلّ (تخطيت حد)، أحمر لو زاد
 *   (حد تخطاك) — وفي الحالتين كمان بيتبعت إشعار محلي عبر Capacitor
 *   (notifications.js) بنفس الاتجاه، كتمهيد لإشعارات أندرويد
 *   الحقيقية لاحقاً (التفاصيل والحدود المتعمّدة مكتوبة هناك).
 * =====================================================
 */

import React, { useState, useEffect, useRef } from 'react';
import AppWrapper        from '../components/layout/AppWrapper';
import Header            from '../components/layout/Header';
import BottomNav         from '../components/layout/BottomNav';
import EgyptianLogo      from '../components/shared/EgyptianLogo.png';
import ExplorerCharacter from '../components/shared/ExplorerCharacter';
import { useApp }        from '../context/AppContext';
import { supabase }      from '../lib/supabaseClient';
import { AvatarDisplay } from '../data/avatars';
import PlayerProfileModal from '../components/leaderboard/PlayerProfileModal';
import RankChangeBadge   from '../components/leaderboard/RankChangeBadge';
import RankChangeToast   from '../components/leaderboard/RankChangeToast';
import { getLastSeenRank, saveLastSeenRank, computeRankChange } from '../lib/rankTracking';
import { notifyRankOvertaken, notifyRankImproved } from '../lib/notifications';

const TROPHY_STYLES = {
  gold:   { iconClass: 'fi-sr-first-medal',  color: '#F5B700', label: 'المركز الأول'  },
  silver: { iconClass: 'fi-sr-second-medal', color: '#A8A8B3', label: 'المركز الثاني' },
  bronze: { iconClass: 'fi-sr-third-medal',  color: '#CD7F32', label: 'المركز الثالث' },
};

function TrophyIcon({ type }) {
  if (!type || !TROPHY_STYLES[type]) return null;
  const { iconClass, color, label } = TROPHY_STYLES[type];

  return (
    <i
      className={`fi ${iconClass}`}
      role="img"
      aria-label={label}
      style={{ fontSize: '28px', color, filter: `drop-shadow(0 2px 3px ${color}66)` }}
    />
  );
}

function LeaderboardPage() {

  const { goBack, userProfile, session } = useApp();

  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [rankChange, setRankChange] = useState(null);   // آخر تغيّر معروف (يغذّي الشارة الصغيرة)
  const [toast, setToast] = useState(null);              // تنبيه لحظي عابر (يغذّي RankChangeToast)

  const myLastKnownRef = useRef(null);   // آخر {rank, points} معروض فعلياً في نفس الجلسة
  const toastTimeoutRef = useRef(null);

  /*
   * جلب قائمة المتصدرين + اكتشاف تغيّر ترتيبي.
   * isLiveUpdate=false  → أول تحميل: قارن بـ localStorage (عبر الزيارات/الجلسات)
   * isLiveUpdate=true   → حدث Realtime وانت واقف في الصفحة: قارن بآخر حالة في نفس الجلسة
   */
  async function refreshLeaderboard(isLiveUpdate) {
    const { data, error } = await supabase
      .from('leaderboard')
      .select('*')
      .order('rank');

    if (error) {
      console.error('❌ خطأ في تحميل قائمة المتصدرين:', error);
      if (!isLiveUpdate) { setPlayers([]); setLoading(false); }
      return;
    }

    const TROPHY_BY_RANK = { 1: 'gold', 2: 'silver', 3: 'bronze' };
    setPlayers((data || []).map(row => ({
      id: row.id,
      rank: row.rank,
      trophy: TROPHY_BY_RANK[row.rank] || null,
      avatar: row.character,
      name: row.username,
      levelReached: row.level_reached,
      points: row.total_points,
      isCurrentUser: row.id === session?.user?.id,
    })));
    if (!isLiveUpdate) setLoading(false);

    const mine = (data || []).find(row => row.id === session?.user?.id);
    if (!mine) return;

    const current = { rank: mine.rank, points: mine.total_points };
    const previous = isLiveUpdate ? myLastKnownRef.current : getLastSeenRank(session.user.id);
    const change = computeRankChange(previous, current);

    if (change) {
      setRankChange({ ...change, id: Date.now() }); // id فريد عشان الشارة تعمل أنيميشن من جديد كل مرة

      if (isLiveUpdate) {
        if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
        setToast({
          id: Date.now(),
          direction: change.overtaken ? 'down' : 'up',
          message: change.overtaken
            ? 'حد تخطاك في الترتيب! 😬 كمّل العب وارجع مكانك'
            : `تخطيت حد في الترتيب! 🎉 دلوقتي في المركز ${current.rank}`,
        });
        toastTimeoutRef.current = setTimeout(() => setToast(null), 4000);
      }

      if (change.overtaken) {
        notifyRankOvertaken({ newRank: current.rank, previousRank: previous.rank });
      } else {
        notifyRankImproved({ newRank: current.rank, previousRank: previous.rank });
      }
    }

    myLastKnownRef.current = current;
    saveLastSeenRank(session.user.id, current);
  }

  /* التحميل الأول + الاشتراك اللحظي في تغييرات leaderboard_stats */
  useEffect(() => {
    setLoading(true);
    refreshLeaderboard(false);

    const channel = supabase
      .channel('leaderboard-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leaderboard_stats' },
        () => refreshLeaderboard(true)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, [session?.user?.id]);

  return (
    <AppWrapper>
      <Header showBack={true} onBack={goBack} />

      <RankChangeToast toast={toast} onDismiss={() => setToast(null)} />

      <main
        className="flex-1 overflow-y-auto overflow-x-hidden app-scroll"
        style={{ paddingBottom: 'calc(96px + env(safe-area-inset-bottom, 0px))' }}
      >

        {/* قسم الرأس */}
        <div className="flex items-end justify-between px-4 pt-2 gap-2">
          <img
            src={EgyptianLogo}
            alt="شعار ميسوري"
            width={82}
            height={82}
            className="drop-shadow-lg flex-shrink-0"
          />

          <div className="flex-1 min-w-0 flex flex-col items-center pb-2">
            <div className="flex items-center gap-2 mb-1">
              <span style={{ color: '#C8922A', fontSize: '14px' }}>✦</span>
              <h1
                className="font-black text-xl truncate"
                style={{ fontFamily: "'Cinzel', serif", color: '#3D2B1F' }}
              >
                Leaderboard
              </h1>
              <span style={{ color: '#C8922A', fontSize: '14px' }}>✦</span>
            </div>

            <span
              className="font-bold text-base"
              style={{ fontFamily: "'Cairo', sans-serif", color: '#805D1B' }}
            >
              قائمة المتصدرين
            </span>

            <p
              className="text-center text-xs mt-2 px-1"
              style={{ fontFamily: "'Cairo', sans-serif", color: '#8B4513', lineHeight: 1.6 }}
            >
              هنا يمكنك الاطلاع على أفضل اللاعبين
              <br />في رحلتهم عبر تاريخ مصر القديمة!
            </p>
          </div>

          <div className="flex-shrink-0">
            <ExplorerCharacter size={62} gender={userProfile.character} />
          </div>
        </div>


        {/* جدول المتصدرين */}
        <div className="px-4 mt-4">

          <div
            className="grid grid-cols-3 px-4 py-2 rounded-t-xl mb-1"
            style={{ backgroundColor: '#3D2B1F' }}
          >
            {['الترتيب', 'اللاعب', 'النقاط'].map((header) => (
              <span
                key={header}
                className="text-center text-xs font-bold text-white"
                style={{ fontFamily: "'Cairo', sans-serif" }}
              >
                {header}
              </span>
            ))}
          </div>

          {loading ? (
            <p className="text-center text-sm py-8" style={{ fontFamily: "'Cairo', sans-serif", color: '#8B5A2B' }}>
              جاري تحميل الترتيب...
            </p>
          ) : players.length === 0 ? (
            <p className="text-center text-sm py-8" style={{ fontFamily: "'Cairo', sans-serif", color: '#8B5A2B' }}>
              لسه محدش ظهر في الترتيب — كن أول اللاعبين!
            </p>
          ) : (
          <div className="space-y-1.5">
            {players.map((player) => {

              const isMe = player.isCurrentUser;

              return (
                <div
                  key={player.id}
                  onClick={() => { if (!isMe) setSelectedPlayer(player); }}
                  className="rounded-xl px-3 py-3 flex items-center press-effect no-tap-highlight"
                  style={{
                    backgroundColor: isMe
                      ? '#2D6A3F'
                      : player.rank <= 3
                        ? 'rgba(200,146,42,0.08)'
                        : 'white',
                    cursor: isMe ? 'default' : 'pointer',
                    border: isMe ? '2px solid #4ADE80' : '1px solid rgba(200,146,42,0.15)',
                    boxShadow: isMe ? '0 0 12px rgba(45,106,63,0.3)' : 'none',
                    transition: 'background-color 0.6s ease, box-shadow 0.6s ease',
                  }}
                >

                  {/* عمود الترتيب — relative عشان يستضيف شارة التغيّر */}
                  <div className="w-1/5 flex justify-center relative">
                    {player.trophy ? (
                      <TrophyIcon type={player.trophy} />
                    ) : (
                      <span
                        className="font-black text-lg"
                        style={{ fontFamily: "'Cairo', sans-serif", color: isMe ? 'white' : '#3D2B1F' }}
                      >
                        {player.rank}
                      </span>
                    )}
                    {isMe && rankChange && (
                      <RankChangeBadge key={rankChange.id} rankDelta={rankChange.rankDelta} />
                    )}
                  </div>

                  {/* عمود اللاعب */}
                  <div className="flex-1 flex items-center gap-2.5">
                    <div
                      className="rounded-full flex-shrink-0 overflow-hidden"
                      style={{ border: `2px solid ${isMe ? 'rgba(255,255,255,0.4)' : 'rgba(200,146,42,0.3)'}` }}
                    >
                      <AvatarDisplay avatarKey={player.avatar} size={40} />
                    </div>

                    <div>
                      <p
                        className="font-bold text-sm"
                        style={{ fontFamily: "'Cairo', sans-serif", color: isMe ? 'white' : '#3D2B1F' }}
                      >
                        {player.name}
                      </p>
                      <p
                        className="text-xs"
                        style={{ fontFamily: "'Cairo', sans-serif", color: isMe ? 'rgba(255,255,255,0.7)' : '#8B5A2B' }}
                      >
                        Level {player.levelReached}
                      </p>
                    </div>
                  </div>

                  {/* عمود النقاط */}
                  <div className="w-1/5 text-center">
                    <p
                      className="font-black text-base"
                      style={{ fontFamily: "'Cairo', sans-serif", color: isMe ? '#FBBF24' : '#C8922A' }}
                    >
                      {player.points}
                    </p>
                    <p
                      className="text-xs"
                      style={{ fontFamily: "'Cairo', sans-serif", color: isMe ? 'rgba(255,255,255,0.7)' : '#8B5A2B', fontSize: '10px' }}
                    >
                      نقطة
                    </p>
                  </div>

                </div>
              );
            })}
          </div>
          )}
        </div>
      </main>

      <BottomNav activePage="leaderboard" />

      {selectedPlayer && (
        <PlayerProfileModal player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />
      )}
    </AppWrapper>
  );
}

export default LeaderboardPage;
