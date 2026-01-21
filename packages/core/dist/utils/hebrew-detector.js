"use strict";
// Hebrew text detection utility
Object.defineProperty(exports, "__esModule", { value: true });
exports.isHebrew = isHebrew;
function isHebrew(text) {
    return /[\u0590-\u05FF]/.test(text);
}
