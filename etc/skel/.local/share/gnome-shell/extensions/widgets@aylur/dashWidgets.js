'use strict';

const { GObject, St, Clutter, GLib, Gio, GnomeDesktop, Shell, NM } = imports.gi;
const Me = imports.misc.extensionUtils.getCurrentExtension();
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const Util = imports.misc.util;
const AppFavorites = imports.ui.appFavorites;
const Dash = imports.ui.dash;
const SystemActions = imports.misc.systemActions;
const MediaPlayer = Me.imports.mediaPlayer;
const SystemLevels = Me.imports.systemLevels;

// USERBOX
var UserBox = GObject.registerClass(
class UserBox extends St.Bin{
    _init(vertical, iconSize){
        super._init({
            x_expand: true,
            y_expand: true,
            reactive: true,
            style_class: 'events-button db-user-box',
        });
        this.userIcon = new St.Bin({
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
            x_expand: true,
            y_expand: true,
            style_class: 'db-user-icon',
            style: 'background-image: url("/var/lib/AccountsService/icons/'+ GLib.get_user_name() +'"); background-size: cover;',
        });
        if(iconSize){
            this.userIcon.width = iconSize;
            this.userIcon.height = iconSize;
        }else{
            this.userIcon.width = 120;
            this.userIcon.height = 120;
        }
        this.userName = new St.Label({
            text: GLib.get_user_name(),
            x_expand: true,
            y_expand: true,
        });
        this.greet = new St.Label({
            text: this._getGreet(),
            x_expand: true,
            y_expand: true,
        });
        this.userText = new St.BoxLayout({
            vertical: true,
            x_expand: true,
            y_expand: true,
        });
        this.userText.add_child(this.userName);
        this.userText.add_child(this.greet);

        this._buildUI(vertical);
    }
    _getGreet(){
        let time = new Date();
        let hour = time.getHours();
        let greet = "Good Evening!";
        if(hour > 6){ greet = "Good Morning!"; }
        if(hour > 12){greet = "Good Afternoon!";}
        if(hour > 18){greet = "Good Evening!";}
        return greet;
    }
    _buildUI(vertical){
        let box = new St.BoxLayout({
            vertical: vertical,
            style_class: 'db-container'
        });
        box.add_child(this.userIcon);
        box.add_child(this.userText);
        this.set_child(box);
        if(vertical){
            this.greet.x_align = Clutter.ActorAlign.CENTER;
            this.userName.x_align = Clutter.ActorAlign.CENTER;
            this.userText.x_align = Clutter.ActorAlign.CENTER;
        }else{
            this.userText.y_align = Clutter.ActorAlign.CENTER;
        }
    }
});

//SYSTEM LEVELS
var LevelsBox = GObject.registerClass(
class LevelsBox extends St.BoxLayout{
    _init(vertical, parentDialog){
        super._init({
            x_expand: true,
            y_expand: true,
            style_class: 'events-button db-levels-box db-container',
            vertical: true,
            reactive: true,
        });

        this.levels = [
            new SystemLevels.PowerLevel(vertical),
            new SystemLevels.DirLevel(vertical),
            new SystemLevels.CpuLevel(vertical),
            new SystemLevels.RamLevel(vertical),
            new SystemLevels.TempLevel(vertical),
        ];

        this._buildUI(vertical);
        this.connect('destroy', () => this.stopTimeout());
        parentDialog.connect('opened', () => this.startTimeout());
        parentDialog.connect('closed', () => this.stopTimeout());
    }
    startTimeout(){
        this.timeout = Mainloop.timeout_add_seconds(1.0, this.updateLevels.bind(this));
    }
    stopTimeout(){
        if(this.timeout){
            Mainloop.source_remove(this.timeout);
            this.timeout = null;
        }
    }
    updateLevels(){
        this.levels.forEach(l => {
            l.updateLevel();
        });
        return true;
    }
    _buildUI(vertical){
        if(vertical){
            this.vertical = false;
        }
        this.levels.forEach(s => {
            this.add_child(s);
        });
    }
});

//MEDIA
var MediaBox = GObject.registerClass(
class MediaBox extends St.Bin{
    _init(vertical, coverSize){
        super._init({
            x_expand: true,
            y_expand: true,
            style_class: 'events-button db-media-box',
            reactive: true,
        });

        this.vertical = vertical;
        this.coverSize = coverSize;

        this.media = new MediaPlayer.Media();
        this.media.connect('updated', () => this._sync());

        this._sync();
    }

    _sync(){
        let mpris = this.media.getPlayer();
        if(mpris){

            this.player = new MediaPlayer.Player(mpris);
            this._buildPlayerUI();
            this.set_child(this.player);
            
        }else{
            this.set_child(new St.Label({
                text: 'Nothing Playing',
                x_align: Clutter.ActorAlign.CENTER,
                y_align: Clutter.ActorAlign.CENTER
            }));
        }
    }

    _buildPlayerUI(){
        let elements = this.player;
        let box = this.player;

        elements.mediaCover.width = this.coverSize;
        elements.mediaCover.height = this.coverSize;
        box.style_class = 'media-container';
        box.vertical = this.vertical;
        box.y_align = Clutter.ActorAlign.CENTER;

        let vbox = new St.BoxLayout({
            style_class: 'media-container',
            vertical: true,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
            x_expand: true,
        });
        vbox.add_child(elements.titleBox);
        vbox.add_child(elements.controlsBox);
        vbox.add_child(elements.volumeBox);

        box.add_child(elements.mediaCover);
        box.add_child(vbox);
    }
});

//LINKS
const LinkButton = GObject.registerClass(
class LinkButton extends St.Button{
    _init(name, link, parentDialog){
        super._init({
            child: new St.Icon({
                gicon: Gio.icon_new_for_string(
                    Me.dir.get_path() + '/media/'+name+'-symbolic.svg'
                ),
                style_class: 'db-link-icon',
            }),
            style_class: 'events-button db-link-btn',
            x_expand: true,
            can_focus: true,
        });
        this.connect('clicked', () => {
            Util.spawnCommandLine('xdg-open '+link);
            parentDialog.close();
        });
        this.add_style_class_name('db-'+name+'-btn');
    }
});

var LinksBox = GObject.registerClass(
class LinksBox extends St.BoxLayout{
    _init(vertical, settings, parentDialog){
        super._init({
            style_class: 'db-container',
            x_expand: true,
            y_expand: true,
            reactive: true,
        });
        if(vertical) this.vertical = true;
        let names = settings.get_strv('dash-link-names');
        let urls = settings.get_strv('dash-link-urls');

        this.links = [];

        for (let i = 0; i < urls.length; i++) {
            if(names[i] !== undefined){
                this.links.push(new LinkButton(names[i], urls[i], parentDialog));
            }else{
                this.links.push(new LinkButton('none', urls[i], parentDialog));
            }
        }

        this.links.forEach(ch => this.add_child(ch) );
    }
});

//CLOCK
var ClockBox = GObject.registerClass(
class ClockBox extends St.BoxLayout{
    _init(vertical){
        super._init({
            style_class: 'events-button db-clock-box',
            x_expand: true,
            reactive: true,
        });
        this.clock = new St.Label({
            style_class: 'db-clock',
            y_align: Clutter.ActorAlign.CENTER,
            x_align: Clutter.ActorAlign.CENTER,
            x_expand: true,
            y_expand: true
        });
        this.date = new St.Label({
            style_class: 'db-date',
            y_align: Clutter.ActorAlign.CENTER,
            x_align: Clutter.ActorAlign.CENTER,
            x_expand: true,
            y_expand: true
        });
        this.day = new St.Label({
            style_class: 'db-day',
            y_align: Clutter.ActorAlign.CENTER,
            x_align: Clutter.ActorAlign.CENTER,
            x_expand: true,
            y_expand: true
        });

        let vbox = new St.BoxLayout({
            vertical: true,
            y_align: Clutter.ActorAlign.CENTER,
            x_align: Clutter.ActorAlign.CENTER,
            x_expand: true,
        });
        vbox.add_child(this.day);
        vbox.add_child(this.date);
        this.add_child(this.clock);
        this.add_child(vbox);
        if(vertical) this.vertical = true;
        if(vertical) vbox.style = 'text-align: center';

        this.wallclock = new GnomeDesktop.WallClock();
        this.wallclock.connectObject(
            'notify::clock',
            () => this.updateClock(), this);

        this.connect('destroy', () => {
            this.wallclock.disconnectObject(this);
            this.wallclock = null;
        });
    
        this.updateClock();
    }
    updateClock(){
        //b - short month; m - month num; d- day num; A - day name;
        this.clock.text = GLib.DateTime.new_now_local().format('%H:%M ');
        this.date.text = GLib.DateTime.new_now_local().format('%Y. %m. %d.');
        this.day.text = GLib.DateTime.new_now_local().format('%A');
    }
});

const AppBtn = GObject.registerClass(
class AppBtn extends Dash.DashIcon{
    _init(app, parentDialog, settings, pos){
        super._init(app);

        this.app = app;
        this.pos = pos;
        this.settings = settings;

        this.connect('clicked', () => {
            parentDialog.close();
        });

        this._changeIconSize();
        this.settings.connect('changed::dash-app-icon-size', this._changeIconSize.bind(this));
        this.connect('destroy', this._onDestroy.bind(this));
    }

    _onDestroy(){
        this.settings.run_dispose();
        this.settings = null;
    }

    _changeIconSize(){
        this.icon.setIconSize(this.settings.get_int('dash-app-icon-size'));
    }

    acceptDrop(source){
        AppFavorites.getAppFavorites().moveFavoriteToPos(
            source.app.get_id(),
            this.pos
        )
    }
});

var AppBox = GObject.registerClass(
class AppBox extends St.BoxLayout{
    _init(settings, parentDialog){
        super._init({
            vertical: true,
            style_class: 'events-button db-container',
            y_expand: true,
            x_expand: true,
            reactive: true,
        });

        this.settings = settings;
        this.parentDialog = parentDialog;

        this.settings.connect('changed::dash-apps-rows', this._reload.bind(this));
        this.settings.connect('changed::dash-apps-cols', this._reload.bind(this));
        AppFavorites.getAppFavorites().connectObject('changed', this._reload.bind(this), this);
        this._reload();
        
        this.connect('destroy', this._onDestroy.bind(this));
    }

    _reload(){
        this.rows = [];
        this.remove_all_children();
        this._buildUI();
    }

    _buildUI(){
        let rows = this.settings.get_int('dash-apps-rows');
        let cols = this.settings.get_int('dash-apps-cols');

        let favs = AppFavorites.getAppFavorites().getFavorites();
        for (let i = 0; i < rows; i++) {
            let row = new St.BoxLayout({
                style_class: 'db-container',
                y_expand: true,
                x_expand: true,
                y_align: Clutter.ActorAlign.CENTER,
                x_align: Clutter.ActorAlign.CENTER,
            });
            this.rows.push(row);
            this.add_child(row);
        }
        let k = 0;
        for (let i = 0; i < favs.length; i++) {
            if(i !== 0 && i%cols === 0) k++;
            if(this.rows[k]){
                this.rows[k].add_child(new AppBtn(favs[i], this.parentDialog, this.settings, i));
            }else{
                return;
            }
        }
    }

    _onDestroy(){
        AppFavorites.getAppFavorites().disconnectObject(this);
        this.settings.run_dispose();
        this.settings = null;
    }
});

const SysBtn = GObject.registerClass(
class SysBtn extends St.Button{
    _init(icon, callback, iconSize, parentDialog){
        super._init({
            style_class: 'popup-menu-item db-sys-btn',
            child: new St.Icon({
                icon_name: icon,
                style_class: 'db-sys-icon',
                icon_size: iconSize
            }),
            y_expand: true,
            x_expand: true,
            can_focus: true
        });
        this.connect('clicked', callback);
        this.connect('clicked', () => parentDialog.close());
    }
});

var SysBox = GObject.registerClass(
class SysBox extends St.BoxLayout{
    _init(vertical, iconSize, parentDialog){
        super._init({
            style_class: 'db-container events-button',
        });
        if(vertical) this.vertical = true;
        if(iconSize) this.iconSize = iconSize;
        else this.iconSize = 22;

        this.parentDialog = parentDialog;

        this._buildUI();
    }
    _buildUI(){
        let wifi = new SysBtn('network-wireless-signal-good-symbolic', () => Shell.AppSystem.get_default().lookup_app('gnome-wifi-panel.desktop').activate(), this.iconSize, this.parentDialog);
        let settings = new SysBtn('org.gnome.Settings-symbolic', () => Shell.AppSystem.get_default().lookup_app('org.gnome.Settings.desktop').activate(), this.iconSize, this.parentDialog);
        let bluetooth = new SysBtn('bluetooth-active-symbolic', () => Shell.AppSystem.get_default().lookup_app('gnome-bluetooth-panel.desktop').activate(), this.iconSize, this.parentDialog);

        if(this.vertical){
            this.add_child(settings);
            this.add_child(bluetooth);
            this.add_child(wifi);
        }else{
            this.add_child(wifi);
            this.add_child(bluetooth);
            this.add_child(settings);
        }
    }
});

var SysActionsBox = GObject.registerClass(
class SysActionsBox extends St.BoxLayout{
    _init(layout, iconSize, parentDialog){
        super._init({
            style_class: 'db-container events-button',
        });
        this.layout = layout;
        if(iconSize) this.iconSize = iconSize;

        let sysActions = SystemActions.getDefault();
        this.powerOff = new SysBtn('system-shutdown-symbolic', () => sysActions.activateAction('power-off'), this.iconSize, parentDialog);
        this.restart = new SysBtn('system-reboot-symbolic', () => sysActions.activateAction('restart'), this.iconSize, parentDialog);
        this.logout = new SysBtn('system-log-out-symbolic', () => sysActions.activateAction('logout'), this.iconSize, parentDialog);
        this.suspend = new SysBtn('weather-clear-night-symbolic', () => sysActions.activateAction('suspend'), this.iconSize, parentDialog);

        this._buildUI();
    }
    _buildUI(){
        switch (this.layout) {
            case 0:
                this.rowLayout(); break;
            case 1:
                this.colLayout(); break;
            case 2:
                this.boxLayout(); break;
            default:
                this.boxLayout(); break;
        }
    }
    rowLayout(){
        this.add_child(this.suspend);
        this.add_child(this.logout);
        this.add_child(this.restart);
        this.add_child(this.powerOff);
    }
    colLayout(){
        this.vertical = true;
        this.add_child(this.powerOff);
        this.add_child(this.restart);
        this.add_child(this.logout);
        this.add_child(this.suspend);
    }
    boxLayout(){
        this.vertical = true;
        let row1 = new St.BoxLayout({
            style_class: 'db-container',
            x_expand: true,
            y_expand: true
        });
        let row2 = new St.BoxLayout({
            style_class: 'db-container',
            x_expand: true,
            y_expand: true
        });
        row1.add_child(this.logout);
        row1.add_child(this.powerOff);
        row2.add_child(this.suspend);
        row2.add_child(this.restart);
        this.add_child(row1);
        this.add_child(row2);
    }
});
