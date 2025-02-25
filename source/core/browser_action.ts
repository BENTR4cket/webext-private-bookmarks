import locked_bookmarks_icon from "url:../icons/main/locked-bookmarks.svg";
import unlocked_bookmarks_icon from "url:../icons/main/unlocked-bookmarks.svg";
import { browser, Tabs } from "webextension-polyfill-ts";

import { bookmarks_locked } from "./bookmarks";
import { add_message_listener, BusyStatusChangeMessage } from "./messages";
import { options } from "./options";

async function update_icon() {
    const icon = (await bookmarks_locked()) ? locked_bookmarks_icon : unlocked_bookmarks_icon;
    browser.browserAction.setIcon({
        path: {
            "16": icon,
            "32": icon,
            "48": icon,
            "64": icon,
            "96": icon,
            "128": icon,
            "256": icon,
        },
    });
}

const MIN_BUSY_BADGE_DISPLAY_DURATION_MS = 1000;

async function update_busy_status_badge(
    busy_status_change: BusyStatusChangeMessage,
    badge_clear_timeout?: number
): Promise<number | undefined> {
    clearTimeout(badge_clear_timeout);

    if (busy_status_change.kind === "busy-status-begin") {
        await browser.browserAction.setBadgeBackgroundColor({ color: "rgb(45, 45, 45)" });
        await browser.browserAction.setBadgeText({ text: "⌛" });
    } else {
        return window.setTimeout(() => {
            browser.browserAction.setBadgeText({ text: "" });
        }, MIN_BUSY_BADGE_DISPLAY_DURATION_MS);
    }
}

async function update_availability_in_tab(tab: Tabs.Tab) {
    if ((await options()).limit_to_private_context && !tab.incognito) {
        browser.browserAction.setTitle({
            title:
                browser.i18n.getMessage("extension_name") +
                ` (${browser.i18n.getMessage("requirement_private_context")})`,
            tabId: tab.id,
        });
        browser.browserAction.disable(tab.id);
    } else {
        browser.browserAction.setTitle({
            title: browser.i18n.getMessage("extension_name"),
            tabId: tab.id,
        });
        browser.browserAction.enable(tab.id);
    }
}

async function update_availability_in_activated_tab(info: Tabs.OnActivatedActiveInfoType) {
    await update_availability_in_tab(await browser.tabs.get(info.tabId));
}

async function update_availability_management() {
    const limit_to_private_context = (await options()).limit_to_private_context;

    (await browser.tabs.query({ active: true })).forEach(tab => {
        update_availability_in_tab(tab);
    });

    if (limit_to_private_context) {
        browser.tabs.onActivated.addListener(update_availability_in_activated_tab);
    } else {
        browser.tabs.onActivated.removeListener(update_availability_in_activated_tab);
    }
}

export async function manage_browser_action(): Promise<void> {
    let busy_badge_clear_timeout: number | undefined;
    await update_icon();
    await update_availability_management();
    add_message_listener(async message => {
        if (message.kind === "lock-status-change") {
            await update_icon();
        } else if (message.kind === "busy-status-begin" || message.kind === "busy-status-end") {
            busy_badge_clear_timeout = await update_busy_status_badge(
                message,
                busy_badge_clear_timeout
            );
        } else if (message.kind === "options-change") {
            await update_availability_management();
        }
    });
}
