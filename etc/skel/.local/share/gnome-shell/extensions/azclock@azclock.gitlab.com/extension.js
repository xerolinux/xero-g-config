const {
    Clutter, Gio, GnomeDesktop, GLib,
    GObject, Meta, Pango, Shell, St
} = imports.gi;

const DND = imports.ui.dnd;
const ExtensionUtils = imports.misc.extensionUtils;
const Main = imports.ui.main;
const Me = ExtensionUtils.getCurrentExtension();
const PopupMenu = imports.ui.popupMenu;

const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const _ = Gettext.gettext;

let settings, azClock, extensionConnections;

var Clock = GObject.registerClass(
class AzClock_Clock extends St.BoxLayout {
    _init(settings) {
        super._init({
            vertical: true,
            reactive: true,
            track_hover: true,
            can_focus: true,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.FILL,
        });

        this._settings = settings;
        this._menuManager = new PopupMenu.PopupMenuManager(this);

        this._time = new St.Label({
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._time.clutter_text.set({
            ellipsize: Pango.EllipsizeMode.NONE,
        });

        this._date = new St.Label({
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._date.clutter_text.set({
            ellipsize: Pango.EllipsizeMode.NONE,
        });

        this.add_child(this._time);
        this.add_child(this._date);

        this._wallClock = new GnomeDesktop.WallClock({ time_only: true });
        this._clockUpdateId = this._wallClock.connect('notify::clock', this.updateClock.bind(this));

        this.connect('notify::hover', () => this._onHover());
        this.connect('destroy', this._onDestroy.bind(this));

        if(!this._settings.get_boolean('lock-widget'))
            this.makeDraggable();

        this.updateClock();
        this.setTextStyle();
        this.setLabelPositions();
        this.setStyle();
    }

    _getMetaRectForCoords(x, y){
        this.get_allocation_box();
        let rect = new Meta.Rectangle();
    
        [rect.x, rect.y] = [x, y];
        [rect.width, rect.height] = this.get_transformed_size();
        return rect;
    }
    
    _getWorkAreaForRect(rect){
        let monitorIndex = global.display.get_monitor_index_for_rect(rect);
        return Main.layoutManager.getWorkAreaForMonitor(monitorIndex);
    }

    _isOnScreen(x, y){
        let rect = this._getMetaRectForCoords(x, y);
        let monitorWorkArea = this._getWorkAreaForRect(rect);

        return monitorWorkArea.contains_rect(rect);
    }

    _keepOnScreen(x, y){
        let rect = this._getMetaRectForCoords(x, y);
        let monitorWorkArea = this._getWorkAreaForRect(rect);

        let monitorRight = monitorWorkArea.x + monitorWorkArea.width;
        let monitorBottom = monitorWorkArea.y + monitorWorkArea.height;

        x = Math.min(Math.max(monitorWorkArea.x, x), monitorRight - rect.width);
        y = Math.min(Math.max(monitorWorkArea.y, y), monitorBottom - rect.height);

        return [x, y];
    }

    setPosition(){
        if(this._ignorePositionUpdate)
            return;

        let [x, y] = this._settings.get_value('clock-location').deep_unpack();
        this.set_position(x, y);

        if(!this.get_parent())
            return;

        if(!this._isOnScreen(x, y)){
            [x, y] = this._keepOnScreen(x, y);

            this.ease({
                x,
                y,
                duration: 150,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD
            });

            this._ignorePositionUpdate = true;
            this._settings.set_value('clock-location', new GLib.Variant('(ii)', [x, y]));
            this._ignorePositionUpdate = false;
        }
    }

    setStyle(){
        let [borderEnabled, borderWidth, borderRadius, borderColor] = this._settings.get_value('widget-border').deep_unpack();
        let [backgroundEnabled, backgroundColor] = this._settings.get_value('widget-background').deep_unpack();

        let style = `padding: 25px;
                     text-align: center;`;

        if(backgroundEnabled)
            style += `background-color: ${backgroundColor};`;

        if(borderEnabled)
            style += `border-radius: ${borderRadius}px;
                      border-width: ${borderWidth}px;
                      border-color: ${borderColor};`;

        this.style = style;
    }

    setTextStyle(){
        let [xOffset, yOffset, spread, shadowColor] = this._settings.get_value('text-shadow').deep_unpack();
        let [fontEnabled, fontFamily] = this._settings.get_value('font-family').deep_unpack();
        let textColor = this._settings.get_string('text-color');
        let timeFontSize = this._settings.get_int('time-font-size');
        let dateFontSize = this._settings.get_int('date-font-size');

        let textStyle = `color: ${textColor};
                         text-shadow: ${xOffset}px ${yOffset}px ${spread}px ${shadowColor};`;

        if(fontEnabled){
            let fontDesc = Pango.font_description_from_string(fontFamily);

            /* Keep for future implementation
            let fontStyle = parsePangoEnum(Pango.Style, fontDesc.get_style());
            let fontStretch = parsePangoEnum(Pango.Stretch, fontDesc.get_stretch());
            let fontWeight = parsePangoEnum(Pango.Weight, fontDesc.get_weight());

            These seem to only work for certain fonts?
            if(fontStyle) textStyle += `font-style: ${fontStyle};`;
            if(fontStretch) textStyle += `font-stretch: ${fontStretch[1]};`;
            if(fontWeight) textStyle += `font-weight: ${fontDesc.get_weight()};`;*/

            textStyle += `font-family: "${fontDesc.get_family()}";`;
        }

        this._time.style = `font-size: ${timeFontSize}pt;` + 'font-feature-settings: "tnum";' + textStyle;
        this._date.style = `font-size: ${dateFontSize}pt;` + textStyle;

        this._queueRelayout();
    }

    _queueRelayout(){
        //queue a relayout of the actors
        this._time.queue_relayout();
        this._date.queue_relayout();
        this.queue_relayout();
    }

    setLabelPositions(){
        this.vertical = !this._settings.get_boolean('time-date-inline');
        this.set_child_at_index(this._time, this._settings.get_enum('time-date-order'));

        this.updateClock();
    }

    updateClock() {
        let date = new Date();
        const timeDateInline = this._settings.get_boolean('time-date-inline');
        const dateFormat = this._settings.get_string('date-format');

        //Add spacing if time-date-inline on
        //'\u0020' is space char
        if(timeDateInline)
            this._time.text = `\u0020\u0020${this._wallClock.clock}\u0020\u0020`;
        else
            this._time.text = this._wallClock.clock;

        this._date.text = date.toLocaleFormat(dateFormat);

        /* Alternate Date Format
            //dayPeriod: "short"
            //timeZoneName: 'short'
            var timeOptions = { hour: 'numeric', minute: 'numeric', second: 'numeric',
                                hour12: false, };
            this._time.text = new Intl.DateTimeFormat('default', timeOptions).format(date);

            var dateOptions = { weekday: 'long', year: 'numeric',
                                month: 'long', day: 'numeric' };
            this._date.text = new Intl.DateTimeFormat('default', dateOptions).format(date);
        */

        this._queueRelayout();
    }

    vfunc_button_press_event() {
        let event = Clutter.get_current_event();

        if (event.get_button() === 1)
            this._setPopupTimeout();
        else if (event.get_button() === 3) {
            this._popupMenu();
            return Clutter.EVENT_STOP;
        }

        return Clutter.EVENT_PROPAGATE;
    }

    _onDragBegin() {
        if(this._menu)
            this._menu.close(true);
        this._removeMenuTimeout();

        this.isDragging = true;
        this._dragMonitor = {
            dragMotion: this._onDragMotion.bind(this)
        };
        DND.addDragMonitor(this._dragMonitor);

        let p = this.get_transformed_position();
        this.startX = this.oldX = p[0];
        this.startY = this.oldY = p[1];

        this.get_allocation_box();
        this.rowHeight = this.height;
        this.rowWidth = this.width;
    }

    _onDragMotion(dragEvent) {
        this.deltaX = dragEvent.x - ( dragEvent.x - this.oldX );
        this.deltaY = dragEvent.y - ( dragEvent.y - this.oldY );

        let p = this.get_transformed_position();
        this.oldX = p[0];
        this.oldY = p[1];

        return DND.DragMotionResult.CONTINUE;
    }

    _onDragEnd() {
        if (this._dragMonitor) {
            DND.removeDragMonitor(this._dragMonitor);
            this._dragMonitor = null;
        }

        this._settings.set_value('clock-location', new GLib.Variant('(ii)', [this.deltaX, this.deltaY]));
    }

    getDragActorSource() {
        return this;
    }

    makeDraggable(){
        this._draggable = DND.makeDraggable(this);
        this._draggable._animateDragEnd = (eventTime) => {
            this._draggable._animationInProgress = true;
            this._draggable._onAnimationComplete(this._draggable._dragActor, eventTime);
        };
        this.dragBeginId = this._draggable.connect('drag-begin', this._onDragBegin.bind(this));
        this.dragEndId = this._draggable.connect('drag-end', this._onDragEnd.bind(this));
    }

    _onHover() {
        if(!this.hover)
            this._removeMenuTimeout();
    }

    _removeMenuTimeout() {
        if (this._menuTimeoutId > 0) {
            GLib.source_remove(this._menuTimeoutId);
            this._menuTimeoutId = 0;
        }
    }

    _setPopupTimeout() {
        this._removeMenuTimeout();
        this._menuTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 600, () => {
            this._menuTimeoutId = 0;
            this._popupMenu();
            return GLib.SOURCE_REMOVE;
        });
        GLib.Source.set_name_by_id(this._menuTimeoutId, '[azclock] this.popupMenu');
    }

    _popupMenu() {
        this._removeMenuTimeout();

        if (!this._menu) {
            this._menu = new PopupMenu.PopupMenu(this, 0.5, St.Side.TOP);
            let lockWidgetItem = this._menu.addAction('', () => {
                this._menu.close();
                this._settings.set_boolean('lock-widget', !this._settings.get_boolean('lock-widget'));
            });

            lockWidgetItem.label.text = this._settings.get_boolean('lock-widget') ? _("Unlock") : _("Lock");

            this._menu.addAction(_("Desktop Clock Settings"), () => {
                ExtensionUtils.openPrefs();
            });

            Main.uiGroup.add_actor(this._menu.actor);
            this._menuManager.addMenu(this._menu);
        }

        this._menu.open();
        return false;
    }

    _onDestroy() {
        if(this._clockUpdateId){
            this._wallClock.disconnect(this._clockUpdateId)
            this._clockUpdateId = null;
        }

        this._wallClock.run_dispose();
    }
});

function enable() {
    settings = ExtensionUtils.getSettings();
    createClock();
}

function disable() {
    destroyClock();

    settings.run_dispose();
    settings = null;
}

function destroyClock(){
    extensionConnections.forEach((object, id) => {
        if(id)
            object.disconnect(id);
    });
    extensionConnections = null;

    azClock.destroy();
    azClock = null;
}

function createClock(destroy){
    if(destroy)
        destroyClock();

    azClock = new Clock(settings);
    azClock.set_pivot_point(0.5, 0.5);

    //Clock needs to be above wallpaper and below any active windows.
    Main.layoutManager._backgroundGroup.add_child(azClock);
    azClock.setPosition();

    extensionConnections = new Map();
    extensionConnections.set(settings.connect('changed::text-color', () => azClock.setTextStyle()), settings);
    extensionConnections.set(settings.connect('changed::text-shadow', () => azClock.setTextStyle()), settings);
    extensionConnections.set(settings.connect('changed::time-font-size', () => azClock.setTextStyle()), settings);
    extensionConnections.set(settings.connect('changed::date-font-size', () => azClock.setTextStyle()), settings);
    extensionConnections.set(settings.connect('changed::font-family', () => azClock.setTextStyle()), settings);

    extensionConnections.set(settings.connect('changed::widget-border', () => azClock.setStyle()), settings);
    extensionConnections.set(settings.connect('changed::widget-background', () => azClock.setStyle()), settings);

    extensionConnections.set(settings.connect('changed::clock-location', () => azClock.setPosition()), settings);

    extensionConnections.set(settings.connect('changed::time-date-inline', () => azClock.setLabelPositions()), settings);
    extensionConnections.set(settings.connect('changed::time-date-order', () => azClock.setLabelPositions()), settings);

    extensionConnections.set(settings.connect('changed::date-format', () => azClock.updateClock()), settings);

    extensionConnections.set(settings.connect('changed::lock-widget', () => createClock(true)), settings);

    extensionConnections.set(Main.layoutManager.connect('monitors-changed', () => azClock.setPosition()), Main.layoutManager);
}

function init() {
    ExtensionUtils.initTranslations(Me.metadata['gettext-domain']);
}

/* Keep for future implementation
function parsePangoEnum(enumType, enumValue){
    if(enumType === Pango.Stretch){
        switch(enumValue){
            case Pango.Stretch.ULTRA_CONDENSED:
                return ['UltraCondensed', 'ultra-condensed']
            case Pango.Stretch.EXTRA_CONDENSED:
                return ['ExtraCondensed', 'extra-condensed']
            case Pango.Stretch.CONDENSED:
                return ['Condensed', 'condensed']
            case Pango.Stretch.SEMI_CONDENSED:
                return ['SemiCondensed', 'semi-condensed']
            case Pango.Stretch.NORMAL:
                return ''
            case Pango.Stretch.SEMI_EXPANDED:
                return ['SemiExpanded', 'semi-expanded']
            case Pango.Stretch.EXPANDED:
                return ['Expanded', 'expanded']
            case Pango.Stretch.EXTRA_EXPANDED:
                return ['ExtraExpanded', 'extra-expanded']
            case Pango.Stretch.ULTRA_EXPANDED:
                return ['UltraExpanded', 'ultra-expanded']
            default:
                return '';
        }
    }
    else if(enumType === Pango.Style){
        switch(enumValue){
            case Pango.Style.NORMAL:
                return ''
            case Pango.Style.OBLIQUE:
                return 'oblique'
            case Pango.Style.ITALIC:
                return 'italic'
            default:
                return '';
        }
    }
    else if(enumType === Pango.Weight){
        switch(enumValue){
            case Pango.Weight.THIN:
                return ['Thin', '100']
            case Pango.Weight.ULTRALIGHT:
                return ['ExtraThin','200']
            case Pango.Weight.LIGHT:
                return ['Light','300']
            case Pango.Weight.SEMILIGHT:
                return ['SemiThin','350']
            case Pango.Weight.BOOK:
                return ['Book','380']
            case Pango.Weight.NORMAL:
                return ''
            case Pango.Weight.MEDIUM:
                return ['Medium','500']
            case Pango.Weight.SEMIBOLD:
                return ['SemiBold','600']
            case Pango.Weight.BOLD:
                return ['Bold','700']
            case Pango.Weight.ULTRABOLD:
                return ['ExtraBold','800']
            case Pango.Weight.HEAVY:
                return ['Heavy','900']
            case Pango.Weight.ULTRAHEAVY:
                return ['ExtraHeavy','1000']
            default:
                return '';
        }
    }
}
*/
