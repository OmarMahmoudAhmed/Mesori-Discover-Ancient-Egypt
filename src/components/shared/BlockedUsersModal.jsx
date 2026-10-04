/*
 * قائمة اللاعبين المحظورين + إلغاء الحظر (بتتفتح من الإعدادات).
 */
import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { useApp } from '../../context/AppContext';
import { AvatarDisplay } from '../../data/avatars';

function BlockedUsersModal({ onClose }) {
  const { listBlockedUsers, unblockUser } = useApp();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await listBlockedUsers();
    if (err) setError('حصلت مشكلة في تحميل القائمة'); else setUsers(data);
    setLoading(false);
  }, [listBlockedUsers]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleUnblock = async (id) => {
    setBusyId(id);
    setError('');
    const { error: err } = await unblockUser(id);
    if (err) setError('تعذّر إلغاء الحظر، حاول تاني'); else setUsers((prev) => prev.filter((u) => u.id !== id));
    setBusyId(null);
  };

  return createPortal(
    <motion.div className="fixed inset-0 z-[60] flex items-end justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      role="dialog" aria-modal="true" aria-label="اللاعبون المحظورون">
      <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={onClose} />
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="relative w-full max-w-md rounded-t-3xl p-6 max-h-[80dvh] overflow-y-auto"
        style={{ backgroundColor: '#FDF3E3', fontFamily: "'Cairo', sans-serif", paddingBottom: 'calc(2rem + env(safe-area-inset-bottom, 0px))' }}
        dir="rtl"
      >
        <button onClick={onClose} className="absolute left-4 top-4 w-8 h-8 rounded-full flex items-center justify-center"
          style={{ backgroundColor: 'rgba(200,146,42,0.15)' }} aria-label="إغلاق">
          <i className="fi fi-rr-cross" aria-hidden="true" style={{ fontSize: '13px', color: '#8B5A2B' }} />
        </button>
        <h2 className="font-black text-base mb-4 text-center" style={{ color: '#3D2B1F' }}>اللاعبون المحظورون</h2>

        {loading ? (
          <p className="text-center text-sm py-6" style={{ color: '#8B5A2B' }}>جاري التحميل...</p>
        ) : users.length === 0 ? (
          <p className="text-center text-sm py-6" style={{ color: '#8B5A2B' }}>مفيش لاعبين محظورين</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {users.map((u) => (
              <li key={u.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: 'white', border: '1px solid rgba(200,146,42,0.2)' }}>
                <AvatarDisplay avatarKey={u.avatar} size={36} />
                <span className="flex-1 font-bold text-sm truncate" style={{ color: '#3D2B1F' }}>{u.username}</span>
                <button
                  onClick={() => handleUnblock(u.id)}
                  disabled={busyId === u.id}
                  className="px-3 py-2 rounded-lg text-xs font-bold text-white"
                  style={{ backgroundColor: busyId === u.id ? '#A9793F' : '#805D1B' }}
                >
                  إلغاء الحظر
                </button>
              </li>
            ))}
          </ul>
        )}
        {error && <p role="alert" className="text-xs font-bold text-center mt-3" style={{ color: '#B91C1C' }}>{error}</p>}
      </motion.div>
    </motion.div>,
    document.body
  );
}

export default BlockedUsersModal;
