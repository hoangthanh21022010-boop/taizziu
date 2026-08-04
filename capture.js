// ============================================================
//  🎲 TÀI XỈU CAPTURE - CHẠY 24/7 TRÊN RENDER
// ============================================================

const puppeteer = require('puppeteer');
const express = require('express');
const fs = require('fs');

// ===== TÀI KHOẢN =====
const USERNAME = 'thanhbadboy345';
const PASSWORD = 'Thanh123@';

// ===== API =====
const API_URL = 'https://tx-proxy-worker.onrender.com/api/result';

// ===== WEB SERVER =====
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('🎲 Tài Xỉu Capture đang chạy!'));
app.get('/status', (req, res) => {
    res.json({
        status: 'running',
        uptime: process.uptime(),
        pid: process.pid
    });
});
app.listen(PORT, () => console.log(`✅ Server: http://localhost:${PORT}`));

// ===== LOG =====
function log(msg) {
    const time = new Date().toISOString();
    console.log(`[${time}] ${msg}`);
    try { fs.appendFileSync('log.txt', `[${time}] ${msg}\n`); } catch(e) {}
}

// ===== CAPTURE =====
async function autoCapture() {
    log('🚀 Khởi động Puppeteer...');
    
    let browser, page;
    
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        page = await browser.newPage();
        
        // 1. Vào game
        log('🌐 Vào game...');
        await page.goto('https://web.net71.win/', { waitUntil: 'networkidle2' });
        log('✅ Đã vào game');
        
        // 2. Đăng nhập
        log('🔑 Đang đăng nhập...');
        try {
            await page.click('.btn-login, [class*="login"]');
            await page.waitForTimeout(1000);
        } catch(e) {}
        
        await page.type('input[name="username"], input[type="text"]', USERNAME);
        await page.type('input[name="password"], input[type="password"]', PASSWORD);
        log('✅ Đã nhập thông tin');
        
        await page.click('.btn-login, [class*="login"], button[type="submit"]');
        await page.waitForTimeout(3000);
        log('✅ Đã click đăng nhập');
        
        // 3. Đóng thông báo
        await page.evaluate(() => {
            document.querySelectorAll('.close, .btn-close, button').forEach(btn => {
                if (btn.textContent.includes('Đóng') || btn.textContent.includes('×')) btn.click();
            });
        });
        
        // 4. Vào bàn
        log('🎯 Vào bàn Tài Xỉu...');
        await page.waitForTimeout(2000);
        await page.evaluate(() => {
            const items = document.querySelectorAll('.game-item, .game-card, [class*="game"]');
            for (const item of items) {
                if ((item.textContent || '').toLowerCase().includes('tài xỉu')) {
                    item.click();
                    return;
                }
            }
        });
        log('✅ Đã vào bàn');
        
        // 5. Inject script
        log('📡 Inject capture...');
        await page.evaluateOnNewDocument(() => {
            (function() {
                const API_URL = 'https://tx-proxy-worker.onrender.com/api/result';
                let processed = new Set();
                let processing = false;
                
                function send(data) {
                    if (processing) return;
                    processing = true;
                    fetch(API_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(data)
                    }).finally(() => { processing = false; });
                }
                
                function hook(comp) {
                    const orig = comp.request;
                    if (typeof orig !== 'function') return false;
                    
                    comp.request = function(route, data, cb, target) {
                        if (route === 'TMD1') {
                            const origCb = cb;
                            cb = function(res) {
                                if (res && res.Dices && res.Dices.length === 3) {
                                    const session = res.GameSession || res.Session || Date.now();
                                    if (processed.has(session)) return origCb.call(this, res);
                                    const state = res.GameState || 0;
                                    if (state !== 2 && state !== 3) return origCb.call(this, res);
                                    
                                    processed.add(session);
                                    const dice = res.Dices;
                                    const total = dice.reduce((a, b) => a + b, 0);
                                    const result = total >= 11 ? 'Tài' : 'Xỉu';
                                    
                                    const entry = {
                                        session, dice, total, result,
                                        gameState: state,
                                        remainTime: res.RemainTime || 0,
                                        time: new Date().toISOString()
                                    };
                                    
                                    console.log('🎯 Kết quả:', entry);
                                    send(entry);
                                }
                                return origCb.call(this, res);
                            };
                        }
                        return orig.call(this, route, data, cb, target);
                    };
                    return true;
                }
                
                function find() {
                    try {
                        const nodes = window.cc?.game?._persistRootNodes;
                        for (const key in nodes || {}) {
                            const node = nodes[key];
                            if (node?._name === 'NetworkClient') {
                                const comp = node._components?.[0];
                                if (comp && comp.requests && hook(comp)) {
                                    console.log('✅ Hook TMD1 thành công!');
                                    return true;
                                }
                            }
                        }
                    } catch(e) {}
                    return false;
                }
                
                let retry = 0;
                function init() {
                    if (find()) return;
                    retry++;
                    if (retry < 20) setTimeout(init, 1000);
                    else console.log('❌ Không tìm thấy networkComp');
                }
                init();
            })();
        });
        
        await page.reload({ waitUntil: 'networkidle2' });
        log('✅ Script đã chạy!');
        
        // Giữ chạy
        setInterval(async () => {
            try {
                await page.evaluate(() => 1);
                log('🔄 Vẫn đang chạy...');
            } catch(e) {
                log('⚠️ Lỗi, khởi động lại...');
                await browser.close();
                await autoCapture();
            }
        }, 60000);
        
    } catch(e) {
        log(`❌ Lỗi: ${e.message}`);
        if (browser) await browser.close();
        setTimeout(autoCapture, 10000);
    }
}

// ===== START =====
log('🚀 Bắt đầu...');
autoCapture();

// ===== XỬ LÝ CRASH =====
process.on('uncaughtException', async (err) => {
    log(`❌ Crash: ${err.message}`);
    setTimeout(autoCapture, 5000);
});
