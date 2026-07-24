// Live cam display (default: the explore.org Brooks Falls, Katmai bear cam).
// A muted YouTube live stream takes a slot in the WeatherStar rotation like any
// other display — its checkbox appears in settings, and ?bearcam=<videoId>
// overrides the stream.
//
// KEEPALIVE (default on): the stream is attached once and left connected while
// other displays show (the container collapses to height 0 but the player keeps
// buffering), so cutting to the bears is INSTANT — no join/buffer moment every
// rotation. Costs one continuously-decoded muted stream (fine on a Pi 5).
// ?bearcam-keepalive=false restores attach-on-show/detach-on-hide for low-power
// hosts, spending a few seconds joining on each visit instead.
import STATUS from './status.mjs';
import WeatherDisplay from './weatherdisplay.mjs';
import { registerDisplay } from './navigation.mjs';

const DEFAULT_VIDEO_ID = 'J7ZrIDvqlic';
// explore.org River Watch (KRV) — stays on when the solar Brooks Falls cams
// power-save (their stream then airs a frozen HIGHLIGHT slate, or the player
// wedges buffering / stops on the endscreen). ?bearcam-fallback=<id> overrides,
// ?bearcam-fallback= (empty) disables the swap.
const DEFAULT_FALLBACK_ID = 'wkVLYfU-Kew';
// If currentTime stops advancing this long, the stream is declared wedged and
// the player re-attaches on the other id. Long enough to ride out a normal
// live-stream join/buffer.
const STALL_MS = 45_000;
// After a primary wedge, stay parked on the fallback this long before giving
// the primary another try (explore.org power-saving lasts hours, not seconds).
const FALLBACK_HOLD_MS = 30 * 60_000;

class BearCam extends WeatherDisplay {
	constructor(navId, elemId) {
		super(navId, elemId, 'Bear Cam', true);

		this.timing.totalScreens = 1;
		// ~27s per visit (3 base delays of 9s) — short enough that the frequent
		// interleaved visits (navigation.mjs bearcamEvery) don't drown the
		// weather. Raise to [5] for longer soaks.
		this.timing.delay = [3];

		const params = new URLSearchParams(window.location.search);
		this.videoId = params.get('bearcam') || DEFAULT_VIDEO_ID;
		this.keepAlive = params.get('bearcam-keepalive') !== 'false';
		this.fallbackId = params.get('bearcam-fallback') ?? DEFAULT_FALLBACK_ID;

		// Stall watchdog state: the embed is created with enablejsapi=1 and a
		// 'listening' handshake, after which the widget posts infoDelivery
		// (currentTime/playerState) that the message listener below tracks.
		this.fallbackUntil = 0;
		this.lastCT = -1;
		this.advancedAt = 0;
		window.addEventListener('message', (e) => {
			const frame = this.elem?.querySelector('.bearcam-frame');
			if (!frame?.contentWindow || e.source !== frame.contentWindow) return;
			let d;
			try { d = JSON.parse(e.data); } catch { return; }
			if (d?.event !== 'infoDelivery' || !d.info) return;
			if (typeof d.info.currentTime === 'number' && d.info.currentTime > this.lastCT + 0.25) {
				this.lastCT = d.info.currentTime;
				this.advancedAt = Date.now();
			}
			if (d.info.playerState === 0) this.advancedAt = 0;	// ended: wedged now
		});
		setInterval(() => this.watchdog(), 10_000);
	}

	async getData(weatherParameters, refresh) {
		// No external data — the stream is the content. Still call super so the
		// enabled/disabled bookkeeping stays consistent with every other display.
		if (!super.getData(weatherParameters, refresh)) return;
		// Keepalive: start the (muted, hidden) stream as soon as the display
		// system is up, so the first rotation visit is already buffered.
		if (this.keepAlive && this.enabled) this.attachStream();
		this.setStatus(STATUS.loaded);
	}

	drawCanvas() {
		super.drawCanvas();
		this.finishDraw();
	}

	showCanvas(navCmd) {
		this.attachStream();
		super.showCanvas(navCmd);
	}

	hideCanvas() {
		super.hideCanvas();
		if (!this.keepAlive) this.detachStream();
	}

	activeId() {
		return (this.fallbackId && Date.now() < this.fallbackUntil) ? this.fallbackId : this.videoId;
	}

	attachStream() {
		const frame = this.elem.querySelector('.bearcam-frame');
		if (!frame || frame.getAttribute('src')) return;
		const id = encodeURIComponent(this.activeId());
		this.lastCT = -1;
		this.advancedAt = Date.now();
		frame.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&controls=0&playsinline=1&rel=0&enablejsapi=1`;
		// The widget only reports playback once a listener announces itself;
		// repeat until torn down (harmless once established).
		clearInterval(this.listenTimer);
		this.listenTimer = setInterval(() => {
			try {
				frame.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 'bearcam', channel: 'widget' }), '*');
			} catch { /* frame between navigations */ }
		}, 2_000);
	}

	detachStream() {
		const frame = this.elem.querySelector('.bearcam-frame');
		if (frame) frame.removeAttribute('src');
		clearInterval(this.listenTimer);
		this.listenTimer = null;
	}

	// A wedged stream (frozen slate / endless buffer / endscreen stop) would
	// otherwise sit in the rotation forever — keepalive means nobody re-attaches
	// it. On stall: primary -> park on the fallback for FALLBACK_HOLD_MS;
	// fallback wedged too -> bounce back and retry the primary.
	watchdog() {
		const frame = this.elem?.querySelector('.bearcam-frame');
		if (!frame?.getAttribute('src')) return;
		if (Date.now() - this.advancedAt < STALL_MS) return;
		if (this.fallbackId && this.activeId() === this.videoId) {
			this.fallbackUntil = Date.now() + FALLBACK_HOLD_MS;
		} else {
			this.fallbackUntil = 0;
		}
		this.detachStream();
		this.attachStream();
	}
}

// register display
registerDisplay(new BearCam(12, 'bearcam'));
