// ==UserScript==
// @name         YouTube Arrow Control — Volume & Seek
// @namespace    https://github.com/Jenich91/YouTube-Arrow-Control-Volume-Seek
// @version      1.4
// @description  Надёжное управление YouTube через стрелки: ↑/↓ громкость, ←/→ перемотка с анимацией, Shift увеличивает шаг. Работает всегда, вне зависимости от фокуса. Анимация перемотки центрирована по видео.
// @author       Jenich91
// @license      MIT
// @match        https://www.youtube.com/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // ---------------- CONFIG ----------------
    const VOLUME_STEP = 5;
    const VOLUME_STEP_SHIFT = 10;
    const SEEK_STEP = 5;
    const SEEK_STEP_SHIFT = 10;
    const ANIM_DURATION = 700; // ms
    // ----------------------------------------

    // ---------------- STYLES ----------------
    const style = document.createElement('style');
    style.textContent = `
        #ytSeekAnim {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            padding: 10px 20px;
            background: rgba(0,0,0,0.7);
            color: #fff;
            font-size: 24px;
            border-radius: 5px;
            pointer-events: none;
            opacity: 0;
            transition: opacity ${ANIM_DURATION/2}ms ease;
            text-align: center;
            z-index: 9999;
        }
    `;
    document.head.appendChild(style);
    // ----------------------------------------

    // ---------------- PLAYER & ANIMATION ----------------
    const player = document.getElementById('movie_player');
    if (!player) return;

    const animDiv = document.createElement('div');
    animDiv.id = 'ytSeekAnim';
    player.appendChild(animDiv);

    function showSeekAnim(text){
        animDiv.textContent = text;
        animDiv.style.opacity = '1';
        clearTimeout(animDiv._timeout);
        animDiv._timeout = window.setTimeout(() => { animDiv.style.opacity = '0'; }, ANIM_DURATION);
    }
    // ------------------------------------------------------

    // ---------------- HELPER FUNCTIONS ----------------
    function getVolume(){
        return player?.getVolume() ?? Math.round((document.querySelector('video')?.volume || 1) * 100);
    }

    function setVolume(pct){
        pct = Math.max(0, Math.min(100, pct));

        if(player?.setVolume) player.setVolume(pct);

        const v = document.querySelector('video');

        if(pct === 0){
            if(player?.mute) player.mute();
            if(v) v.muted = true;
        } else {
            if(player?.unMute) player.unMute();
            if(v) v.muted = false;
        }

        if(v) v.volume = pct / 100;
    }

    function seekBy(sec){
        if(player?.seekBy){
            player.seekBy(sec);
            return;
        }
        const v = document.querySelector('video');
        if(v && isFinite(v.currentTime)) v.currentTime += sec;
    }
    // ------------------------------------------------------

    // ---------------- MAIN KEYHANDLER ----------------
    window.addEventListener('keydown', e => {
        if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) return;

        e.preventDefault();
        e.stopImmediatePropagation();

        const shift = e.shiftKey;

        switch(e.key){
            case 'ArrowUp':
                setVolume(getVolume() + (shift ? VOLUME_STEP_SHIFT : VOLUME_STEP));
                break;
            case 'ArrowDown':
                setVolume(getVolume() - (shift ? VOLUME_STEP_SHIFT : VOLUME_STEP));
                break;
            case 'ArrowLeft': {
                const step = -(shift ? SEEK_STEP_SHIFT : SEEK_STEP);
                seekBy(step);
                showSeekAnim(`${step}s`);
                break;
            }
            case 'ArrowRight': {
                const step = shift ? SEEK_STEP_SHIFT : SEEK_STEP;
                seekBy(step);
                showSeekAnim(`+${step}s`);
                break;
            }
        }
    }, true);
    // ------------------------------------------------------
})();
