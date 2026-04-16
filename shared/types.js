"use strict";
/**
 * Shared runtime values for Last Letter game
 * Keep this file in sync with shared/types.ts for any non-type exports.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LOCAL_STORAGE_KEYS = exports.RANK_POINTS = exports.RANK_THRESHOLDS = void 0;
exports.calculateRank = calculateRank;
exports.getNextRankThreshold = getNextRankThreshold;
exports.RANK_THRESHOLDS = {
    Plastic: 0,
    Iron: 500,
    Silver: 1500,
    Gold: 3000,
    Diamond: 5000,
    Master: 7000,
};
exports.RANK_POINTS = {
    WIN: 100,
    LOSS: -50,
    DRAW: 20,
    WIN_STREAK_2: 20,
    WIN_STREAK_3: 30,
    WIN_STREAK_5: 50,
    FAST_WIN: 10,
    PERFECT_GAME: 15,
    BEAT_STRONGER_PLAYER: 25,
};
function calculateRank(points) {
    if (points >= exports.RANK_THRESHOLDS.Master)
        return 'Master';
    if (points >= exports.RANK_THRESHOLDS.Diamond)
        return 'Diamond';
    if (points >= exports.RANK_THRESHOLDS.Gold)
        return 'Gold';
    if (points >= exports.RANK_THRESHOLDS.Silver)
        return 'Silver';
    if (points >= exports.RANK_THRESHOLDS.Iron)
        return 'Iron';
    return 'Plastic';
}
function getNextRankThreshold(currentRank) {
    var ranks = ['Plastic', 'Iron', 'Silver', 'Gold', 'Diamond', 'Master'];
    var currentIndex = ranks.indexOf(currentRank);
    if (currentIndex === ranks.length - 1)
        return exports.RANK_THRESHOLDS.Master;
    return exports.RANK_THRESHOLDS[ranks[currentIndex + 1]];
}
exports.LOCAL_STORAGE_KEYS = {
    PLAYER_PROFILE: 'last_letter_player_profile',
    ACTIVE_PLAYER_PROFILE: 'last_letter_active_player_profile',
    SAVED_PLAYER_PROFILES: 'last_letter_saved_player_profiles',
    APP_SETTINGS: 'last_letter_app_settings',
    PROCESSED_MATCH_RESULTS: 'last_letter_processed_match_results',
};
//# sourceMappingURL=types.js.map
