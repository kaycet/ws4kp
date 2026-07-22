// Live cam display (default: the explore.org Brooks Falls, Katmai bear cam).
// A muted YouTube live stream takes a slot in the WeatherStar rotation like any
// other display — its checkbox appears in settings, and ?bearcam=<videoId>
// overrides the stream. The iframe src is attached only while the display is
// shown, so the stream isn't decoded (or even connected) during the rest of the
// rotation — this matters on a Raspberry Pi.
import STATUS from './status.mjs';
import WeatherDisplay from './weatherdisplay.mjs';
import { registerDisplay } from './navigation.mjs';

const DEFAULT_VIDEO_ID = 'J7ZrIDvqlic';

class BearCam extends WeatherDisplay {
	constructor(navId, elemId) {
		super(navId, elemId, 'Bear Cam', true);

		this.timing.totalScreens = 1;
		// ~27s per visit (3 base delays of 9s): long enough that the stream's
		// few-second join doesn't eat the slot, short enough that the frequent
		// interleaved visits (navigation.mjs bearcamEvery) don't drown the
		// weather. Raise to [5] for longer soaks.
		this.timing.delay = [3];

		this.videoId = new URLSearchParams(window.location.search).get('bearcam') || DEFAULT_VIDEO_ID;
	}

	async getData(weatherParameters, refresh) {
		// No external data — the stream is the content. Still call super so the
		// enabled/disabled bookkeeping stays consistent with every other display.
		if (!super.getData(weatherParameters, refresh)) return;
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
		this.detachStream();
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
