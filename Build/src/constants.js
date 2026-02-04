export const CONSTANTS = {
    LANES: ['D', 'F', 'J', 'K'],
    HIT_ZONE_PERCENT: 0.8,
    NOTE_SPEED: 0.65,
    WINDOW_PERFECT: 100,
    WINDOW_GOOD: 180
};

export const DIFFICULTY_CONFIG = {
    EASY: { threshold: 0.35, goldThreshold: 0.6, mineChance: 0.0, minInterval: 0.50 },
    NORMAL: { threshold: 0.28, goldThreshold: 0.5, mineChance: 0.05, minInterval: 0.35 },
    HARD: { threshold: 0.18, goldThreshold: 0.4, mineChance: 0.1, minInterval: 0.18 }
};

export const ICONS = {
    play: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>',
    pause: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>'
};