import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SwipeLessonCounter } from '../../shared/swipe';

const lessonKey = 'swipe-horizontal-lesson-v1';
export function useSwipeLesson(session: string, product: string, available: boolean) {
  const counter = useRef(new SwipeLessonCounter());
  const scrolled = useRef(false);
  const [loaded, setLoaded] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    let alive = true;
    void AsyncStorage.getItem(lessonKey).then(value => {
      if (alive) { setDismissed(value === 'done'); setLoaded(true); }
    }).catch(() => { if (alive) { setDismissed(false); setLoaded(true); } });
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    if (!product || !session) return;
    const ready = counter.current.observe(session, product, scrolled.current);
    scrolled.current = false;
    if (!loaded || dismissed || !available || !ready) return;
    const timer = setTimeout(() => setVisible(true), 650);
    return () => clearTimeout(timer);
  }, [session, product, available, loaded, dismissed]);
  const dismiss = useCallback(() => {
    setVisible(false); setDismissed(true);
    void AsyncStorage.setItem(lessonKey, 'done').catch(() => {});
  }, []);
  const onScroll = useCallback(() => { scrolled.current = true; }, []);
  const rebase = useCallback(() => { scrolled.current = false; counter.current.rebase(); }, []);
  return { visible: visible && available && !dismissed, acknowledge: () => { if (visible) dismiss(); }, dismiss, onScroll, rebase };
}
