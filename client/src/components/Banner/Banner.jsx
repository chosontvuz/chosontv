import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useContentLanguage } from '../../context/ContentLanguageContext';
import { useLoading } from '../../context/LoadingContext';
import LoaderSkeleton from '../LoaderSkeleton/LoaderSkeleton';
import { fetchActiveBanners } from '../../api/bannerApi';
import { normalizeImagePath } from '../../utils/utils';
import { useCachedImageLoadReport } from '../../hooks/useImageLoadState';
import './Banner.css';

const BannerSlideImage = ({ src, alt, showSkeleton, onImageLoad, resetKey }) => {
    const normalizedSrc = normalizeImagePath(src);
    const imgRef = useCachedImageLoadReport(normalizedSrc, onImageLoad, resetKey);

    return (
        <>
            {showSkeleton && (
                <LoaderSkeleton variant="banner-image" className="manga-image-skeleton" />
            )}
            <img
                ref={imgRef}
                src={normalizedSrc}
                alt={alt}
                draggable={false}
                className={showSkeleton ? 'is-loading' : ''}
                onLoad={() => onImageLoad(normalizedSrc)}
                onError={(e) => {
                    const fallbackSrc = normalizeImagePath('/img/no-image.png');
                    if (e.currentTarget.src !== fallbackSrc) {
                        e.currentTarget.src = fallbackSrc;
                        return;
                    }
                    onImageLoad(normalizedSrc);
                }}
            />
        </>
    );
};

const BannerTitleImage = ({ src, showSkeleton, onImageLoad, resetKey }) => {
    const normalizedSrc = normalizeImagePath(src);
    const imgRef = useCachedImageLoadReport(normalizedSrc, onImageLoad, resetKey);

    return (
        <div className="manga-title-img-wrapper">
            {showSkeleton && (
                <LoaderSkeleton variant="text" className="manga-title-img-skeleton" width="100%" height={120} />
            )}
            <img
                ref={imgRef}
                className={`manga-title-img ${showSkeleton ? 'is-loading' : ''}`}
                src={normalizedSrc}
                alt=""
                draggable={false}
                onLoad={() => onImageLoad(normalizedSrc)}
                onError={(e) => {
                    const fallbackSrc = normalizeImagePath('/img/no-image.png');
                    if (e.currentTarget.src !== fallbackSrc) {
                        e.currentTarget.src = fallbackSrc;
                        return;
                    }
                    onImageLoad(normalizedSrc);
                }}
            />
        </div>
    );
};

const BannerTitlePreloadImage = ({ src, onImageLoad, resetKey }) => {
    const imgRef = useCachedImageLoadReport(src, onImageLoad, resetKey);

    return (
        <img
            ref={imgRef}
            src={src}
            alt=""
            aria-hidden="true"
            className="manga-title-img-preload"
            onLoad={() => onImageLoad(src)}
            onError={(e) => {
                const fallbackSrc = normalizeImagePath('/img/no-image.png');
                if (e.currentTarget.src !== fallbackSrc) {
                    e.currentTarget.src = fallbackSrc;
                    return;
                }
                onImageLoad(src);
            }}
        />
    );
};

const getSlideMediaState = (image, loadedImageUrls) => {
    const normalizedSrc = normalizeImagePath(image.src);
    const normalizedTitleSrc = image.titleImg ? normalizeImagePath(image.titleImg) : '';
    const isMainLoaded = loadedImageUrls.has(normalizedSrc);
    const isTitleLoaded = !normalizedTitleSrc || loadedImageUrls.has(normalizedTitleSrc);

    return {
        normalizedSrc,
        normalizedTitleSrc,
        isMainLoaded,
        isTitleLoaded,
        isSlideReady: isMainLoaded && isTitleLoaded,
    };
};

const Banner = () => {
    const navigate = useNavigate();
    const { contentLang } = useContentLanguage();
    const { bannerLoading, setLoading } = useLoading();

    const [banners, setBanners] = useState([]);
    const [loadedImageUrls, setLoadedImageUrls] = useState(() => new Set());

    useEffect(() => {
        let isMounted = true;

        const loadBanners = async () => {
            try {
                setLoading('banner', true);
                if (isMounted) {
                    const data = await fetchActiveBanners(contentLang);
                    setBanners(data);
                }
            } catch (_error) {
                if (isMounted) {
                    setBanners([]);
                }
            } finally {
                if (isMounted) {
                    setLoading('banner', false);
                }
            }
        };

        loadBanners();

        return () => {
            isMounted = false;
        };
    }, [contentLang, setLoading]);

    const images = useMemo(() => {
        return banners
            .map((banner) => ({
                id: banner.bannerId,
                src: banner.image || '',
                titleImg: banner.titleImg || '',
                description: banner.description || '',
                specs: banner.specs || null,
                link: banner.movieId ? `/movie/${banner.movieId}` : null,
            }))
            .filter((img) => img.src);
    }, [banners]);

    const imageSrcKey = useMemo(
        () => images.map((image) => `${image.src}|${image.titleImg || ''}`).join('||'),
        [images]
    );

    const prevImageSrcKeyRef = useRef(imageSrcKey);

    // imageSrcKey o'zgaganda Set'ni effect'da emas, renderda tozalash —
    // aks holda child complete-check effect Set'ga qo'shadi, keyin parent effect tozalaydi → stuck.
    if (prevImageSrcKeyRef.current !== imageSrcKey) {
        prevImageSrcKeyRef.current = imageSrcKey;
        setLoadedImageUrls(new Set());
    }

    const handleImageLoaded = useCallback((src) => {
        setLoadedImageUrls((prev) => {
            if (prev.has(src)) return prev;
            const next = new Set(prev);
            next.add(src);
            return next;
        });
    }, []);

    const [currentIndex, setCurrentIndex] = useState(0);
    const [dragOffset, setDragOffset] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [isUserInteracting, setIsUserInteracting] = useState(false);
    const startXRef = useRef(0);
    const currentXRef = useRef(0);
    const carouselRef = useRef(null);
    const slidesRef = useRef(null);
    const autoPlayIntervalRef = useRef(null);
    const dragStartTimeRef = useRef(0);
    const wasDragRef = useRef(false);

    // Auto-play funksiyalari
    const stopAutoPlay = useCallback(() => {
        if (autoPlayIntervalRef.current) {
            clearInterval(autoPlayIntervalRef.current);
            autoPlayIntervalRef.current = null;
        }
    }, []);

    const startAutoPlay = useCallback(() => {
        stopAutoPlay();
        autoPlayIntervalRef.current = setInterval(() => {
            if (!isUserInteracting) {
                setCurrentIndex(prev => (prev + 1) % images.length);
            }
        }, 5000);
    }, [images.length, isUserInteracting, stopAutoPlay]);

    const resetAutoPlay = useCallback(() => {
        stopAutoPlay();
        if (!isUserInteracting) {
            startAutoPlay();
        }
    }, [isUserInteracting, startAutoPlay, stopAutoPlay]);

    // Slayd o'tish funksiyalari
    const goToSlide = useCallback((index) => {
        if (index >= 0 && index < images.length) {
            setCurrentIndex(index);
            setDragOffset(0);
            resetAutoPlay();
        }
    }, [images.length, resetAutoPlay]);

    const nextSlide = useCallback(() => {
        setCurrentIndex(prev => (prev + 1) % images.length);
        setDragOffset(0);
        resetAutoPlay();
    }, [images.length, resetAutoPlay]);

    const prevSlide = useCallback(() => {
        setCurrentIndex(prev => (prev - 1 + images.length) % images.length);
        setDragOffset(0);
        resetAutoPlay();
    }, [images.length, resetAutoPlay]);

    // Drag boshlanishi
    const handleDragStart = (clientX) => {
        wasDragRef.current = false;
        setIsDragging(true);
        setIsUserInteracting(true);
        startXRef.current = clientX;
        currentXRef.current = clientX;
        dragStartTimeRef.current = Date.now();
        stopAutoPlay();
    };

    // Drag harakati
    const handleDragMove = useCallback((clientX) => {
        if (!isDragging) return;
        currentXRef.current = clientX;
        const diff = clientX - startXRef.current;
        if (Math.abs(diff) > 10) wasDragRef.current = true;
        setDragOffset(diff);
    }, [isDragging]);

    const handleSlideClick = (image) => {
        if (wasDragRef.current || !image?.link) return;
        navigate(image.link);
    };

    const handleBannerAction = (event, image) => {
        event.stopPropagation();
        if (!image?.link) return;
        navigate(image.link);
    };

    const stopControlDrag = (event) => {
        event.stopPropagation();
    };

    // Drag tugashi
    const handleDragEnd = useCallback(() => {
        if (!isDragging) return;

        const diff = currentXRef.current - startXRef.current;
        const dragDuration = Date.now() - dragStartTimeRef.current;
        const velocity = Math.abs(diff) / dragDuration;

        const threshold = 300;
        const velocityThreshold = 0.3;

        if (Math.abs(diff) > threshold || velocity > velocityThreshold) {
            if (diff > 0) {
                prevSlide();
            } else {
                nextSlide();
            }
        } else {
            setDragOffset(0);
        }

        setIsDragging(false);
        setIsUserInteracting(false);
        resetAutoPlay();
    }, [isDragging, nextSlide, prevSlide, resetAutoPlay]);

    // Mouse drag
    const handleMouseDown = (e) => {
        e.preventDefault();
        handleDragStart(e.pageX);
    };

    // Touch events
    const handleTouchStart = (e) => {
        handleDragStart(e.touches[0].clientX);
    };

    const handleTouchMove = (e) => {
        handleDragMove(e.touches[0].clientX);
    };

    const handleTouchEnd = () => {
        handleDragEnd();
    };

    // Document event listeners for drag
    useEffect(() => {
        if (!isDragging) return;

        const handleDocumentMouseMove = (e) => {
            handleDragMove(e.pageX);
        };

        const handleDocumentMouseUp = () => {
            handleDragEnd();
        };

        document.addEventListener('mousemove', handleDocumentMouseMove);
        document.addEventListener('mouseup', handleDocumentMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleDocumentMouseMove);
            document.removeEventListener('mouseup', handleDocumentMouseUp);
        };
    }, [isDragging, handleDragMove, handleDragEnd]);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'ArrowLeft') {
                prevSlide();
            } else if (e.key === 'ArrowRight') {
                nextSlide();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [prevSlide, nextSlide]);

    // Mouse enter/leave
    const handleMouseEnter = () => {
        setIsUserInteracting(true);
        stopAutoPlay();
    };

    const handleMouseLeave = () => {
        if (!isDragging) {
            setIsUserInteracting(false);
            startAutoPlay();
        }
    };

    // Visibility change
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden) {
                stopAutoPlay();
            } else {
                if (!isUserInteracting) {
                    startAutoPlay();
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [isUserInteracting, startAutoPlay, stopAutoPlay]);

    // Window resize
    useEffect(() => {
        let resizeTimer;
        const handleResize = () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                setCurrentIndex(prev => prev);
            }, 250);
        };

        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
            clearTimeout(resizeTimer);
        };
    }, []);

    // Auto-play boshlash
    useEffect(() => {
        if (images.length > 0) {
            startAutoPlay();
        }
        return () => stopAutoPlay();
    }, [images.length, startAutoPlay, stopAutoPlay]);

    // Rasmlarni markazlash uchun transform hisoblash
    useEffect(() => {
        if (!slidesRef.current || !carouselRef.current || images.length === 0) return;

        const slidesEl = slidesRef.current;
        const carouselEl = carouselRef.current;

        const updateTransform = () => {
            if (!slidesEl || !carouselEl) return;

            const containerWidth = carouselEl.offsetWidth;
            const slidesStyle = getComputedStyle(slidesEl);
            const columnGap = parseFloat(slidesStyle.columnGap);
            const generalGap = parseFloat(slidesStyle.gap);
            const gap = Number.isFinite(columnGap)
                ? columnGap
                : (Number.isFinite(generalGap) ? generalGap : 0);

            // Markazdagi slayd elementini olish (asosiy blokdagi currentIndex)
            const centerSlideIndex = images.length + currentIndex;
            const centerSlide = slidesEl.children[centerSlideIndex];
            const slideWidth = centerSlide?.offsetWidth ?? slidesEl.querySelector('.manga-image')?.offsetWidth ?? containerWidth * 0.44;

            // Markazdagi slaydning chap chetidan viewport markazigacha bo'lgan masofa
            const centerSlideLeft = centerSlideIndex * (slideWidth + gap);
            const centerSlideCenter = centerSlideLeft + slideWidth / 2;
            const viewportCenter = containerWidth / 2;
            const offset = viewportCenter - centerSlideCenter;

            if (isDragging) {
                slidesEl.style.transition = 'none';
                slidesEl.style.transform = `translateX(${offset + dragOffset}px)`;
            } else {
                slidesEl.style.transition = 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
                slidesEl.style.transform = `translateX(${offset}px)`;
            }
        };

        // Layout tugagach hisoblash
        const rafId = requestAnimationFrame(() => {
            requestAnimationFrame(updateTransform);
        });

        // Konteyner o'lchami o'zgarganda qayta hisoblash
        const resizeObserver = new ResizeObserver(() => {
            requestAnimationFrame(updateTransform);
        });
        resizeObserver.observe(carouselEl);

        return () => {
            cancelAnimationFrame(rafId);
            resizeObserver.disconnect();
        };
    }, [currentIndex, dragOffset, isDragging, images.length]);

    // Slayd pozitsiyalarini hisoblash
    const getSlideClass = (index) => {
        const total = images.length;
        if (total === 0) return 'hidden';

        // Check if this slide should be visible
        const diff = index - currentIndex;

        if (diff === 0) return 'center';
        if (diff === -1 || diff === total - 1) return 'left';
        if (diff === 1 || diff === -(total - 1)) return 'right';

        return 'hidden';
    };

    const renderSlideContent = (image, index, slideClass, isActive) => {
        const {
            normalizedTitleSrc,
            isTitleLoaded,
            isSlideReady,
        } = getSlideMediaState(image, loadedImageUrls);
        const isVisibleSlide = slideClass === 'center' || slideClass === 'left' || slideClass === 'right';
        const showMainSkeleton = isVisibleSlide && (bannerLoading || !isSlideReady);
        const showContentWrapper = isActive && !bannerLoading;
        const showContentDetails = showContentWrapper && isSlideReady;

        return (
        <>
            <BannerSlideImage
                src={image.src}
                alt={`Banner ${index + 1}`}
                showSkeleton={showMainSkeleton}
                onImageLoad={handleImageLoaded}
                resetKey={imageSrcKey}
            />

            {isVisibleSlide && normalizedTitleSrc && !isActive && !isTitleLoaded && (
                <BannerTitlePreloadImage
                    src={normalizedTitleSrc}
                    onImageLoad={handleImageLoaded}
                    resetKey={imageSrcKey}
                />
            )}

            {showContentWrapper && (
                <div className="manga-content">
                    {image.titleImg && (
                        <BannerTitleImage
                            src={image.titleImg}
                            showSkeleton={!isTitleLoaded}
                            onImageLoad={handleImageLoaded}
                            resetKey={imageSrcKey}
                        />
                    )}
                    {showContentDetails && image.description && (
                        <p className="manga-description">{image.description}</p>
                    )}
                    {showContentDetails && image.specs && (
                        <div className="manga-specs">
                            {image.specs.duration != null && image.specs.duration !== '' && (
                                <span>
                                    {image.specs.duration} {contentLang === 'ru' ? 'мин' : 'daqiqa'}
                                </span>
                            )}
                            {image.specs.year != null && image.specs.year !== '' && (
                                <span>
                                    {image.specs.year}{contentLang === 'ru' ? ' г.' : '-yil'}
                                </span>
                            )}
                            {image.specs.ageRating && (
                                <span>
                                    {image.specs.ageRating} {contentLang === 'ru' ? 'лет' : 'yosh'}
                                </span>
                            )}
                            {Array.isArray(image.specs.countries) && image.specs.countries.length > 0 && (
                                <span>{image.specs.countries.join(', ')}</span>
                            )}
                        </div>
                    )}
                    {showContentDetails && image.link && (
                        <div
                            className="manga-actions"
                            onMouseDown={stopControlDrag}
                            onTouchStart={stopControlDrag}
                        >
                            <button
                                type="button"
                                className="manga-action-btn watch"
                                onClick={(event) => handleBannerAction(event, image)}
                            >
                                <span className="manga-play-icon" aria-hidden="true" />
                                Hozir tomosha qilish
                            </button>
                            <button
                                type="button"
                                className="manga-action-btn details"
                                onClick={(event) => handleBannerAction(event, image)}
                            >
                                Batafsil
                                <span className="manga-info-icon" aria-hidden="true">i</span>
                            </button>
                        </div>
                    )}
                </div>
            )}
        </>
        );
    };

    if (images.length === 0) {
        if (!bannerLoading) return null;

        return (
            <div className="banner">
                <div className="banner-container">
                    <div className="manga-carousel">
                        <ul className="manga-slides">
                            <li className="manga-image left" aria-hidden="true">
                                <LoaderSkeleton variant="banner-image" className="manga-image-skeleton" />
                            </li>
                            <li className="manga-image center" aria-hidden="false">
                                <LoaderSkeleton variant="banner-image" className="manga-image-skeleton" />
                            </li>
                            <li className="manga-image right" aria-hidden="true">
                                <LoaderSkeleton variant="banner-image" className="manga-image-skeleton" />
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="banner">
            <div className="banner-container">
            <div
                className={`manga-carousel ${isDragging ? 'is-dragging' : ''}`}
                ref={carouselRef}
                onMouseDown={handleMouseDown}
                onMouseLeave={handleMouseLeave}
                onMouseEnter={handleMouseEnter}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                <button
                    className="manga-nav-btn prev"
                    onClick={prevSlide}
                    onMouseDown={stopControlDrag}
                    onTouchStart={stopControlDrag}
                    aria-label="Oldingi rasm"
                >
                    &#10094;
                </button>

                <button
                    className="manga-nav-btn next"
                    onClick={nextSlide}
                    onMouseDown={stopControlDrag}
                    onTouchStart={stopControlDrag}
                    aria-label="Keyingi rasm"
                >
                    &#10095;
                </button>

                <ul className="manga-slides" ref={slidesRef}>
                    {/* Oldingi rasmlar (clone) - infinite effect uchun */}
                    {images.map((image, index) => {
                        const slideClass = getSlideClass(index - images.length);
                        const { isSlideReady } = getSlideMediaState(image, loadedImageUrls);
                        return (
                        <li
                            key={`prev-${image.id || index}`}
                            className={`manga-image ${slideClass}`}
                            aria-hidden="true"
                            onClick={() => isSlideReady && handleSlideClick(image)}
                            role={image.link ? 'button' : undefined}
                        >
                            {renderSlideContent(image, index, slideClass, slideClass === 'center')}
                        </li>
                        );
                    })}

                    {/* Asosiy rasmlar */}
                    {images.map((image, index) => {
                        const slideClass = getSlideClass(index);
                        const { isSlideReady } = getSlideMediaState(image, loadedImageUrls);
                        return (
                        <li
                            key={image.id || index}
                            className={`manga-image ${slideClass}`}
                            aria-hidden={index !== currentIndex}
                            onClick={() => isSlideReady && handleSlideClick(image)}
                            role={image.link ? 'button' : undefined}
                        >
                            {renderSlideContent(image, index, slideClass, slideClass === 'center')}
                        </li>
                        );
                    })}

                    {/* Keyingi rasmlar (clone) - infinite effect uchun */}
                    {images.map((image, index) => {
                        const slideClass = getSlideClass(index + images.length);
                        const { isSlideReady } = getSlideMediaState(image, loadedImageUrls);
                        return (
                        <li
                            key={`next-${image.id || index}`}
                            className={`manga-image ${slideClass}`}
                            aria-hidden="true"
                            onClick={() => isSlideReady && handleSlideClick(image)}
                            role={image.link ? 'button' : undefined}
                        >
                            {renderSlideContent(image, index, slideClass, slideClass === 'center')}
                        </li>
                        );
                    })}
                </ul>

                <div className="manga-dots">
                    {images.map((_, index) => (
                        <button
                            type="button"
                            key={index}
                            className={`manga-dot ${index === currentIndex ? 'active' : ''}`}
                            onClick={() => goToSlide(index)}
                            onMouseDown={stopControlDrag}
                            onTouchStart={stopControlDrag}
                            aria-label={`Rasm ${index + 1}ga o'tish`}
                            aria-current={index === currentIndex ? 'true' : 'false'}
                        />
                    ))}
                </div>
            </div>
            </div>
        </div>
    );
};

export default Banner;
