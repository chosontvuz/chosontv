import { useCallback, useEffect, useRef, useState } from 'react';

/** Cached / already-decoded image — onLoad qayta kelmasligi mumkin. */
export const isImageElementComplete = (img) =>
  Boolean(img && img.complete && img.naturalWidth > 0);

/**
 * Rasm skeleton race-ini oldini oladi:
 * cache'dan tez onLoad → useEffect reset → ikkinchi onLoad yo'q → stuck.
 *
 * @param {string} src
 * @param {{ enabled?: boolean }} [options] — false bo'lsa (masalan data loading) img hali mount bo'lmagan
 */
export function useImageLoadState(src, options = {}) {
  const { enabled = true } = options;
  const imgRef = useRef(null);
  const normalizedSrc = src ? String(src) : '';
  const [isLoaded, setIsLoaded] = useState(!normalizedSrc);

  useEffect(() => {
    if (!normalizedSrc) {
      setIsLoaded(true);
      return;
    }
    if (!enabled) {
      setIsLoaded(false);
      return;
    }

    setIsLoaded(false);
    const img = imgRef.current;
    if (isImageElementComplete(img)) {
      setIsLoaded(true);
    }
  }, [normalizedSrc, enabled]);

  const markLoaded = useCallback(() => {
    setIsLoaded(true);
  }, []);

  return {
    imgRef,
    isLoaded,
    showLoading: Boolean(normalizedSrc) && enabled && !isLoaded,
    onLoad: markLoaded,
    onError: markLoaded,
    markLoaded,
  };
}

/**
 * Parent Set / loadedImageUrls pattern (Banner): src o'zgaganda Set tozalansa,
 * cached img uchun onLoad qayta kelmasligi mumkin — mount/effect'da complete tekshir.
 * @param {string} src
 * @param {(src: string) => void} onLoaded
 * @param {unknown} [resetKey] — Set tozalanganda (masalan imageSrcKey) qayta report qilish uchun
 */
export function useCachedImageLoadReport(src, onLoaded, resetKey) {
  const imgRef = useRef(null);
  const reportSrc = src ? String(src) : '';

  useEffect(() => {
    if (!reportSrc || typeof onLoaded !== 'function') return;
    const img = imgRef.current;
    if (isImageElementComplete(img)) {
      onLoaded(reportSrc);
    }
  }, [reportSrc, onLoaded, resetKey]);

  return imgRef;
}
