/**
 * Unified Thumbnail Loading System
 * Handles all thumbnail loading logic with proper error handling and fallbacks
 */

class ThumbnailLoader {
    constructor() {
        this.loadingStates = new Map();
    }

    /**
     * Load a single image thumbnail with automatic fallback handling
     * @param {HTMLElement} element - The container element
     * @param {string} fullUrl - Full resolution image URL
     * @param {string} thumbnailUrl - Thumbnail URL (optional)
     * @param {Object} options - Additional options
     */
    loadSingleImage(element, fullUrl, thumbnailUrl = null, options = {}) {
        const {
            maxWidth = 300,
            maxHeight = 200,
            onClick = null,
            className = 'shared-image'
        } = options;

        const loadingKey = `${element.id || element.className}_${fullUrl}`;
        if (this.loadingStates.get(loadingKey)) {
            console.log(`Already loading: ${loadingKey}`);
            return;
        }

        this.loadingStates.set(loadingKey, true);
        element.classList.add('loading');

        // Handle backward compatibility for thumbnail URLs
        if (thumbnailUrl && !thumbnailUrl.includes('/uploads/') && fullUrl.includes('/uploads/')) {
            thumbnailUrl = thumbnailUrl.replace('/static/thumbnails/', '/static/thumbnails/uploads/');
        }

        const tryLoadImage = (urlToTry, isFallback = false) => {
            const img = new Image();
            img.onload = () => {
                console.log(`${isFallback ? 'Fallback' : 'Thumbnail'} loaded: ${urlToTry}`);
                element.innerHTML = `<img src="${urlToTry}" alt="${className}" style="max-width: ${maxWidth}px; max-height: ${maxHeight}px; object-fit: contain; border-radius: 8px; cursor: pointer;" data-full-url="${fullUrl}">`;
                element.classList.remove('loading');

                const imgElement = element.querySelector('img');
                if (imgElement && onClick) {
                    imgElement.addEventListener('click', onClick);
                }

                this.loadingStates.delete(loadingKey);
            };

            img.onerror = () => {
                if (!isFallback && thumbnailUrl && thumbnailUrl.includes('/uploads/')) {
                    // Try old URL format for backward compatibility
                    const oldUrl = thumbnailUrl.replace('/static/thumbnails/uploads/', '/static/thumbnails/');
                    console.warn(`Thumbnail failed: ${urlToTry}, trying old format: ${oldUrl}`);
                    tryLoadImage(oldUrl, true);
                } else if (!isFallback && thumbnailUrl) {
                    // Try full image as thumbnail
                    console.warn(`Thumbnail failed: ${urlToTry}, loading full image`);
                    tryLoadImage(fullUrl, true);
                } else {
                    // All attempts failed, show error
                    console.error(`All image loading attempts failed for: ${fullUrl}`);
                    element.innerHTML = '<div class="media-placeholder"><i class="fas fa-exclamation-triangle fa-2x"></i><span>Failed to load image</span></div>';
                    element.classList.remove('loading');
                    this.loadingStates.delete(loadingKey);
                }
            };

            img.src = urlToTry;
        };

        // Start with thumbnail if available, otherwise go straight to full image
        tryLoadImage(thumbnailUrl || fullUrl);
    }

    /**
     * Load a thumbnail for carousel use
     * @param {HTMLElement} element - The thumbnail container element
     * @param {string} fullUrl - Full resolution image URL
     * @param {string} thumbnailUrl - Thumbnail URL (optional)
     * @param {number} index - Index in carousel
     * @param {Object} options - Additional options
     */
    loadCarouselThumbnail(element, fullUrl, thumbnailUrl = null, index = 0, options = {}) {
        const {
            size = 60,
            onClick = null
        } = options;

        const loadingKey = `carousel_${index}_${fullUrl}`;
        if (this.loadingStates.get(loadingKey)) {
            return;
        }

        this.loadingStates.set(loadingKey, true);
        element.classList.add('loading');

        // Handle backward compatibility for thumbnail URLs
        if (thumbnailUrl && !thumbnailUrl.includes('/uploads/') && fullUrl.includes('/uploads/')) {
            thumbnailUrl = thumbnailUrl.replace('/static/thumbnails/', '/static/thumbnails/uploads/');
        }

        const tryLoadThumbnail = (urlToTry, isFallback = false) => {
            const img = new Image();
            img.onload = () => {
                console.log(`${isFallback ? 'Fallback' : 'Carousel thumbnail'} loaded: ${urlToTry}`);
                element.innerHTML = `<img src="${urlToTry}" alt="Thumbnail" style="width: ${size}px; height: ${size}px; object-fit: cover; border-radius: 4px; cursor: pointer;" data-full-url="${fullUrl}" data-index="${index}">`;
                element.classList.remove('loading');

                const imgElement = element.querySelector('img');
                if (imgElement && onClick) {
                    imgElement.addEventListener('click', onClick);
                }

                this.loadingStates.delete(loadingKey);
            };

            img.onerror = () => {
                if (!isFallback && thumbnailUrl && thumbnailUrl.includes('/uploads/')) {
                    // Try old URL format for backward compatibility
                    const oldUrl = thumbnailUrl.replace('/static/thumbnails/uploads/', '/static/thumbnails/');
                    console.warn(`Carousel thumbnail failed: ${urlToTry}, trying old format: ${oldUrl}`);
                    tryLoadThumbnail(oldUrl, true);
                } else if (!isFallback && thumbnailUrl) {
                    // Try full image as thumbnail
                    console.warn(`Carousel thumbnail failed: ${urlToTry}, using full image as thumbnail`);
                    tryLoadThumbnail(fullUrl, true);
                } else {
                    // All attempts failed, show icon
                    console.error(`All carousel thumbnail attempts failed for: ${fullUrl}`);
                    element.innerHTML = '<i class="fas fa-image" style="font-size: 24px; color: #666;"></i>';
                    element.classList.remove('loading');
                    this.loadingStates.delete(loadingKey);
                }
            };

            img.src = urlToTry;
        };

        // Start with thumbnail if available, otherwise go straight to full image
        tryLoadThumbnail(thumbnailUrl || fullUrl);
    }

    /**
     * Load main carousel image
     * @param {HTMLElement} element - The main image container element
     * @param {string} fullUrl - Full resolution image URL
     * @param {string} thumbnailUrl - Thumbnail URL (optional)
     * @param {Object} options - Additional options
     */
    loadCarouselMainImage(element, fullUrl, thumbnailUrl = null, options = {}) {
        const {
            maxWidth = '100%',
            maxHeight = 400,
            onClick = null
        } = options;

        const loadingKey = `carousel_main_${fullUrl}`;
        if (this.loadingStates.get(loadingKey)) {
            return;
        }

        this.loadingStates.set(loadingKey, true);
        element.classList.add('loading');

        // Handle backward compatibility for thumbnail URLs
        if (thumbnailUrl && !thumbnailUrl.includes('/uploads/') && fullUrl.includes('/uploads/')) {
            thumbnailUrl = thumbnailUrl.replace('/static/thumbnails/', '/static/thumbnails/uploads/');
        }

        const tryLoadMainImage = (urlToTry, isFallback = false) => {
            const img = new Image();
            img.onload = () => {
                console.log(`${isFallback ? 'Fallback' : 'Carousel main'} loaded: ${urlToTry}`);
                element.innerHTML = `<img src="${urlToTry}" alt="Carousel image" style="max-width: ${maxWidth}; max-height: ${maxHeight}px; object-fit: contain; border-radius: 8px; cursor: pointer;" data-full-url="${fullUrl}">`;
                element.classList.remove('loading');

                const imgElement = element.querySelector('img');
                if (imgElement && onClick) {
                    imgElement.addEventListener('click', onClick);
                }

                this.loadingStates.delete(loadingKey);
            };

            img.onerror = () => {
                if (!isFallback && thumbnailUrl && thumbnailUrl.includes('/uploads/')) {
                    // Try old URL format for backward compatibility
                    const oldUrl = thumbnailUrl.replace('/static/thumbnails/uploads/', '/static/thumbnails/');
                    console.warn(`Carousel main failed: ${urlToTry}, trying old format: ${oldUrl}`);
                    tryLoadMainImage(oldUrl, true);
                } else if (!isFallback && thumbnailUrl) {
                    // Try full image
                    console.warn(`Carousel main failed: ${urlToTry}, loading full image`);
                    tryLoadMainImage(fullUrl, true);
                } else {
                    // All attempts failed
                    console.error(`All carousel main image attempts failed for: ${fullUrl}`);
                    element.innerHTML = '<div class="media-placeholder"><i class="fas fa-exclamation-triangle fa-2x"></i><span>Failed to load image</span></div>';
                    element.classList.remove('loading');
                    this.loadingStates.delete(loadingKey);
                }
            };

            img.src = urlToTry;
        };

        // Start with thumbnail if available, otherwise go straight to full image
        tryLoadMainImage(thumbnailUrl || fullUrl);
    }

    /**
     * Clear loading state for a specific key
     * @param {string} key - Loading state key
     */
    clearLoadingState(key) {
        this.loadingStates.delete(key);
    }

    /**
     * Clear all loading states
     */
    clearAllLoadingStates() {
        this.loadingStates.clear();
    }
}

// Create global instance
const thumbnailLoader = new ThumbnailLoader();

// Export for use in other files
window.thumbnailLoader = thumbnailLoader;