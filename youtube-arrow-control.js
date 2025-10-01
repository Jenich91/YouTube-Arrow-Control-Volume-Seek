// ==UserScript==
// @name         YouTube Arrow Control — Volume & Seek
// @namespace    https://github.com/Jenich91/YouTube-Arrow-Control-Volume-Seek
// @version      1.1
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

    // ---------------- UTIL ----------------
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const findPlayer = () => document.getElementById('movie_player');

    // ---------------- VIEW (минимально) ----------------
    function makeView(playerElement){
        const SVG_NS = 'http://www.w3.org/2000/svg';
        // Локальная геометрия HUD (рядом с использованием)
        const HUD_DIAMETER_PX = 96;              // диаметр чёрного круга
        const ICON_SIZE_PX = 56;                 // размер SVG-иконки
        const SEEK_OFFSET_PX = 84;               // смещение подсказки перемотки вниз
        const ARC_CENTER = { x: 40, y: 32 };     // центр дуг
        const ARC_RADII = [6, 11, 17];           // радиусы дуг
        const ARC_STROKES = [2, 2.5, 2.5];       // толщины дуг
        const MUTE_SLASH = { x1: 10, y1: 20, x2: 54, y2: 44, width: 6 }; // диагональ mute
        const css = `
            #ytSeekAnim {
                position: absolute;
                top: calc(50% + ${SEEK_OFFSET_PX}px);
                left: 50%;
                transform: translate(-50%, -50%);
                padding: 10px 20px;
                background: rgba(0, 0, 0, 0.7);
                color: #fff;
                font-size: 24px;
                border-radius: 5px;
                pointer-events: none;
                opacity: 0;
                transition: opacity ${ANIM_DURATION/2}ms ease;
                text-align: center;
                z-index: 99998;
            }

            .yac-hud {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                pointer-events: none;
                z-index: 99999;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0;
                transition: opacity .18s linear;
            }

            .yac-box {
                width: ${HUD_DIAMETER_PX}px;
                height: ${HUD_DIAMETER_PX}px;
                border-radius: 50%;
                background: rgba(0, 0, 0, 0.7);
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .yac-svg { width: ${ICON_SIZE_PX}px; height: ${ICON_SIZE_PX}px; display: block; }
        `;
        const style = document.createElement('style');
        style.textContent = css;
        document.head.appendChild(style);
        if(getComputedStyle(playerElement).position === 'static') playerElement.style.position = 'relative';

        const seekBubble = document.createElement('div'); seekBubble.id = 'ytSeekAnim'; playerElement.appendChild(seekBubble);

        const volumeHud = document.createElement('div'); volumeHud.className = 'yac-hud';
        const hudBox = document.createElement('div'); hudBox.className = 'yac-box';
        const svg = document.createElementNS(SVG_NS,'svg'); svg.setAttribute('viewBox','0 0 64 64'); svg.classList.add('yac-svg');
        const speakerPath = document.createElementNS(SVG_NS,'path'); speakerPath.setAttribute('d','M14 22 L24 22 L36 12 L36 52 L24 42 L14 42 Z'); speakerPath.setAttribute('fill','#fff'); svg.appendChild(speakerPath);
        const arcsGroup = document.createElementNS(SVG_NS,'g');
        arcsGroup.setAttribute('class','yac-arcs');
        const centerX = ARC_CENTER.x, centerY = ARC_CENTER.y;
        ARC_RADII.forEach((radius, index) => {
            const arc = document.createElementNS(SVG_NS,'path');
            arc.setAttribute('d', `M ${centerX} ${centerY - radius} A ${radius} ${radius} 0 0 1 ${centerX} ${centerY + radius}`);
            arc.setAttribute('stroke', '#fff');
            arc.setAttribute('stroke-width', ARC_STROKES[index] || ARC_STROKES[ARC_STROKES.length-1]);
            arc.setAttribute('fill', 'none');
            arc.setAttribute('stroke-linecap', 'round');
            arc.style.transition = 'transform .12s linear, opacity .12s linear';
            arc.style.transformOrigin = `${centerX}px ${centerY}px`;
            arc.style.transform = 'scale(0)';
            arc.style.opacity = '0';
            arc.classList.add('yac-arc');
            arcsGroup.appendChild(arc);
        });
        svg.appendChild(arcsGroup);
        const muteGroup = document.createElementNS(SVG_NS,'g');
        muteGroup.setAttribute('class','yac-mute');
        muteGroup.setAttribute('style','opacity:0;transition:opacity .12s linear');
        const slashPath = document.createElementNS(SVG_NS,'path');
        slashPath.setAttribute('d', `M${MUTE_SLASH.x1} ${MUTE_SLASH.y1} L${MUTE_SLASH.x2} ${MUTE_SLASH.y2}`);
        slashPath.setAttribute('stroke', '#fff');
        slashPath.setAttribute('stroke-width', String(MUTE_SLASH.width));
        slashPath.setAttribute('stroke-linecap', 'round');
        slashPath.setAttribute('fill', 'none');
        muteGroup.appendChild(slashPath);
        svg.appendChild(muteGroup);
        hudBox.appendChild(svg); volumeHud.appendChild(hudBox); playerElement.appendChild(volumeHud);

        // Таймеры автоскрытия храним на самих элементах, чтобы не было пере-присваиваний переменных
        const volumeArcs = svg.querySelectorAll('.yac-arc');
        const muteOverlay = svg.querySelector('.yac-mute');
        return {
            showSeek(text){
                seekBubble.textContent = text;
                seekBubble.style.opacity = '1';
                clearTimeout(seekBubble._hideTimeout);
                seekBubble._hideTimeout = setTimeout(() => { seekBubble.style.opacity = '0'; }, ANIM_DURATION);
            },
            showVolume(percent){
                const volumePercent = clamp(Math.round(percent), 0, 100);
                const visibleArcs = volumePercent === 0 ? 3 : Math.min(3, Math.ceil(volumePercent / 34));
                volumeArcs.forEach((arc, index) => {
                    const isOn = index < visibleArcs;
                    arc.style.transform = isOn ? 'scale(1)' : 'scale(0)';
                    arc.style.opacity = isOn ? '1' : '0';
                });
                muteOverlay.style.opacity = volumePercent === 0 ? '1' : '0';
                volumeHud.style.opacity = '1';
                clearTimeout(volumeHud._hideTimeout);
                volumeHud._hideTimeout = setTimeout(() => { volumeHud.style.opacity = '0'; }, ANIM_DURATION);
            }
        };
    }

    // ---------------- CONTROLLER (logic) ----------------
    function makeController(playerElement){
        const getVideo = () => document.querySelector('video');
        return {
            getVolume(){
                return playerElement?.getVolume?.() ?? Math.round((getVideo()?.volume || 1) * 100);
            },
            setVolume(pct){
                const val = clamp(pct, 0, 100);
                if(playerElement?.setVolume) playerElement.setVolume(val);
                const video = getVideo();
                if(val === 0){ if(playerElement?.mute) playerElement.mute(); if(video) video.muted = true; }
                else { if(playerElement?.unMute) playerElement.unMute(); if(video) video.muted = false; }
                if(video) video.volume = val / 100;
                return val;
            },
            seekBy(sec){
                if(playerElement?.seekBy){ playerElement.seekBy(sec); return; }
                const video = getVideo();
                if(video && isFinite(video.currentTime)) video.currentTime += sec;
            }
        };
    }

    // ---------------- BOOTSTRAP ----------------
    const player = findPlayer();
    if(!player) return;
    const controller = makeController(player);
    const view = makeView(player);

    // ---------------- INPUT ----------------
    window.addEventListener('keydown', event => {
        if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        const isShiftHeld = event.shiftKey;
        switch(event.key){
            case 'ArrowUp':{
                const next = controller.getVolume() + (isShiftHeld ? VOLUME_STEP_SHIFT : VOLUME_STEP);
                view.showVolume(controller.setVolume(next));
                break;
            }
            case 'ArrowDown':{
                const next = controller.getVolume() - (isShiftHeld ? VOLUME_STEP_SHIFT : VOLUME_STEP);
                view.showVolume(controller.setVolume(next));
                break;
            }
            case 'ArrowLeft':{
                const step = -(isShiftHeld ? SEEK_STEP_SHIFT : SEEK_STEP);
                controller.seekBy(step);
                view.showSeek(`${step}s`);
                break;
            }
            case 'ArrowRight':{
                const step = (isShiftHeld ? SEEK_STEP_SHIFT : SEEK_STEP);
                controller.seekBy(step);
                view.showSeek(`+${step}s`);
                break;
            }
        }
    }, true);
})();
