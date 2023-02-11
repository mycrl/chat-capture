import puppeteer, { Page, Browser } from 'puppeteer-core';
import { program } from 'commander';
import { getEdgePath } from './edge';

interface ArgsOptions {
    kind: string
    room: string
}

function getArgsOptions(): ArgsOptions {
    program
        .requiredOption('--kind <char>', 'douyin, tiktok')
        .requiredOption('--room <char>', 'live room code');
    program.parse();
    return program.opts();
}

function getRoomUri(opt: ArgsOptions): string {
    return opt.kind == 'douyin' 
        ? `https://live.douyin.com/${opt.room}` 
        : `https://www.tiktok.com/@${opt.room}/live`;
}

function handlers() {
    const isTikTok = location.host.includes('tiktok')
    const chain = !isTikTok
        ? 'main > div:nth-of-type(3) > div > div:nth-of-type(2) > div > ' + 
          'div:nth-of-type(2) > div:nth-of-type(2) > div > div > div > div > ' + 
          'div > div > div'
        : 'main > div:nth-of-type(2) > div:nth-of-type(2) > div > div > ' + 
          'div > div:nth-of-type(2) > div > div > div:nth-of-type(2) > div > ' + 
          'div:nth-of-type(2) > div:nth-of-type(2)';
    
    const observer = new MutationObserver(muts => {
        for (const mut of muts) {
            if (mut.type === 'childList') {
                for (const node of mut.addedNodes) {
                    const element = node as any;
                    
                    /* If it is tiktok, you can check whether it is a chat 
                    message, and ignore all nodes that are not chat messages. */
                    if (
                        isTikTok && 
                        element.getAttribute('data-e2e') !== 'chat-message'
                    ) {
                        continue;
                    }
                    
                    const info = isTikTok
                      ? {
                          username: element
                            .querySelector('div:nth-of-type(2) > div > span')
                            .innerText,
                          message:  element
                            .querySelector('div:nth-of-type(2) > span')
                            .innerText,
                      }
                      : {
                          username: element
                            .querySelector('div > span:nth-of-type(2)')
                            .innerText
                            .replace('：', ''),
                          message:  element
                            .querySelector('div > span:nth-of-type(3) > span')
                            .innerText,
                      };

                    /* For Douyin, non-chat messages cannot be ignored, 
                    and gift-giving messages and nodes of other people 
                    in Aite are excluded here. */
                    if (
                        !info.message.includes('送出了 ×') && 
                        !info.message.startsWith('@')
                    ) {
                        console.log(JSON.stringify(info));
                    }
                }
            }
        }
    });
    
    const targetNode = document.querySelector(chain);
    if (targetNode) {
        observer.observe(targetNode, {
            childList: true
        });
    }
}

async function isLoginHandler() {
    const isTikTok = location.host.includes('tiktok')
    const chain = isTikTok
        ? 'main > div > div > div:nth-of-type(3) > ' + 
          'div:nth-of-type(5)'
        : '#douyin-header > header > div:nth-of-type(2)' + 
          ' > div:nth-of-type(2) > div > div > div >' + 
          ' div:nth-of-type(6) > div > a'
    return document.querySelector(chain) != null
}

function sleep(timeout: number) {
    return new Promise(resolve => {
        setTimeout(resolve, timeout);
    })
}

async function launch(opt: ArgsOptions, headless: boolean) {
    const browser = await puppeteer.launch({
        headless,
        userDataDir: './.edge_app_data',
        executablePath: getEdgePath(),
        defaultViewport: {
            width: 1920,
            height: 1080,
        }
    });
    
    // reuse empty pages.
    const mainPage = (await browser.pages())[0];
    
    /* Prevents the user agent from marking the current 
    client as headless. */
    await mainPage.setUserAgent(
        (await browser.userAgent())
            .replace('HeadlessChrome', 'Chrome')
    );
    
    await mainPage.goto(getRoomUri(opt));
    return {
        page: mainPage,
        browser,
    }
}

function init(opt: ArgsOptions) {
    return new Promise(async (resolve: (res: {
        page: Page,
        browser: Browser,
    }) => void, reject) => {
        try {
            const firstLaunch = await launch(opt, true);
            await sleep(10000);

            const isLogin = await firstLaunch.page.evaluate(isLoginHandler);
            if (isLogin) {
                return resolve(firstLaunch);
            }

            await firstLaunch.browser.close();
            const loginLaunch = await launch(opt, false);
            loginLaunch.browser.on('disconnected', async () => {
                await sleep(2000);
                return resolve(await launch(opt, true));
            });
        } catch(e) {
            reject(e)
        }
    })
}

void (async function() {
    const opt = getArgsOptions();
    const { browser, page } = await init(opt);
    await sleep(5000);
    await page.evaluate(handlers);

    page.on('console', msg => {
        if (msg.type() === 'log') {
            const text = msg.text();
            if (text.startsWith('{"username":')) {
                process.stdout.write(text + '\r\n');
            }
        }
    });
})();