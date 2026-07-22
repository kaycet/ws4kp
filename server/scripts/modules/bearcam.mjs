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

	attachStream() {
		const frame = this.elem.querySelector('.bearcam-frame');
		if (!frame || frame.getAttribute('src')) return;
		const id = encodeURIComponent(this.videoId);
		frame.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&controls=0&playsinline=1&rel=0`;
	}

	detachStream() {
		const frame = this.elem.querySelector('.bearcam-frame');
		if (frame) frame.removeAttribute('src');
	}
}

// register display
registerDisplay(new BearCam(12, 'bearcam'));
