/* extension.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */
'use strict';

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension()
const BatteryBar = Me.imports.batteryBar;
const DashBoard = Me.imports.dashBoard;
const MediaPlayer = Me.imports.mediaPlayer;
const PowerMenu = Me.imports.powerMenu;
const WorkspaceIndicator = Me.imports.workspaceIndicator;
const NotificationIndicator = Me.imports.notificationIndicator;
const BackgroundClock = Me.imports.backgroundClock;
const DateMenuMod = Me.imports.dateMenuMod;

const GnomeVersion = Math.floor(imports.misc.config.PACKAGE_VERSION);

class Extension {
    constructor() {}
    enable() {
        this.settings = ExtensionUtils.getSettings();

        this.batteryBar = new BatteryBar.Extension();
        this.dashBoard = new DashBoard.Extension();
        this.mediaPlayer = new MediaPlayer.Extension();
        this.powerMenu = new PowerMenu.Extension();
        this.workspaceIndicator = new WorkspaceIndicator.Extension();
        this.notificationIndicator = new NotificationIndicator.Extension();
        this.backgroundClock = new BackgroundClock.Extension();
        this.dateMenuMod = new DateMenuMod.Extension();

        if(this.settings.get_boolean('battery-bar')) this.toggleExtension(this.batteryBar);
        if(this.settings.get_boolean('dash-board')) this.toggleExtension(this.dashBoard);
        if(this.settings.get_boolean('media-player')) this.toggleExtension(this.mediaPlayer);
        if(this.settings.get_boolean('power-menu')) this.toggleExtension(this.powerMenu);
        if(this.settings.get_boolean('workspace-indicator')) this.toggleExtension(this.workspaceIndicator);
        if(this.settings.get_boolean('notification-indicator')) this.toggleExtension(this.notificationIndicator);
        if(this.settings.get_boolean('background-clock')) this.toggleExtension(this.backgroundClock);
        if(this.settings.get_boolean('date-menu-mod')) this.toggleExtension(this.dateMenuMod);
        
        this.settings.connect('changed::battery-bar', () => this.toggleExtension(this.batteryBar));
        this.settings.connect('changed::dash-board', () => this.toggleExtension(this.dashBoard));
        this.settings.connect('changed::media-player', () => this.toggleExtension(this.mediaPlayer));
        this.settings.connect('changed::power-menu', () => this.toggleExtension(this.powerMenu));
        this.settings.connect('changed::workspace-indicator', () => this.toggleExtension(this.workspaceIndicator));
        this.settings.connect('changed::notification-indicator', () => this.toggleExtension(this.notificationIndicator));
        this.settings.connect('changed::background-clock', () => this.toggleExtension(this.backgroundClock));
        this.settings.connect('changed::date-menu-mod', () => this.toggleExtension(this.dateMenuMod));

        if(GnomeVersion >= 43){
            this.quickToggles = new Me.imports.quickToggles.Extension();
            if(this.settings.get_boolean('quick-toggles')) this.toggleExtension(this.quickToggles);
            this.settings.connect('changed::quick-toggles', () => this.toggleExtension(this.quickToggles));
        }
    }

    disable() {
        if(this.batteryBar.enabled){ this.batteryBar.disable(); this.batteryBar.enabled = false; }
        if(this.dashBoard.enabled){ this.dashBoard.disable(), this.dashBoard.enabled = false; }
        if(this.mediaPlayer.enabled) { this.mediaPlayer.disable(); this.mediaPlayer.enabled = false; }
        if(this.powerMenu.enabled){ this.powerMenu.disable(); this.powerMenu.enabled = false; }
        if(this.workspaceIndicator.enabled){ this.workspaceIndicator.disable(); this.workspaceIndicator.enabled = false; }
        if(this.notificationIndicator.enabled){ this.notificationIndicator.disable(); this.notificationIndicator.enabled = false; }
        if(this.backgroundClock.enabled){ this.backgroundClock.disable(); this.backgroundClock.enabled = false; }
        if(this.dateMenuMod.enabled){ this.dateMenuMod.disable(); this.dateMenuMod.enabled = false; }

        this.batteryBar = null;
        this.dashBoard = null;
        this.mediaPlayer = null;
        this.powerMenu = null;
        this.workspaceIndicator = null;
        this.notificationIndicator = null;
        this.backgroundClock = null;
        this.dateMenuMod = null;

        if(GnomeVersion >= 43){
            if(this.quickToggles.enabled){ this.quickToggles.disable(); this.quickToggles.enabled = false; }
            this.quickToggles = null;
        }
    }

    toggleExtension(extension){
        if(!extension.enabled){
            extension.enable();
            extension.enabled = true;
        }else{
            extension.disable();
            extension.enabled = false;
        }
    }
}

function init() {
    return new Extension();
}
