const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc', 'UDc', 'DDc', 'TDc', 'QaDc', 'QiDc', 'SxDc', 'SpDc', 'OcDc', 'NoDc', 'Vg'];

// Short suffix notation (1.23M) or scientific (1.23e6). Values under 1000 keep
// one decimal only when they are fractional, so rates like 0.1/s stay legible.
export const formatNumber = (value, notation = 'short') => {
	if (Number.isNaN(value)) return '0';
	if (!Number.isFinite(value)) return value > 0 ? '∞' : '-∞';
	const sign = value < 0 ? '-' : '';
	const n = Math.abs(value);
	if (n < 1000) {
		if (Number.isInteger(n) || n >= 100) return sign + Math.floor(n).toString();
		return sign + (Math.floor(n * 10) / 10).toString();
	}
	let exp = Math.floor(Math.log10(n));
	if (notation === 'sci' || Math.floor(exp / 3) >= SUFFIXES.length) {
		let mantissa = n / 10 ** exp;
		if (mantissa >= 9.995) { mantissa /= 10; exp += 1; }
		return `${sign}${mantissa.toFixed(2)}e${exp}`;
	}
	let group = Math.floor(exp / 3);
	let scaled = n / 10 ** (group * 3);
	if (scaled >= 999.95) { scaled /= 1000; group += 1; }
	if (group >= SUFFIXES.length) return formatNumber(value, 'sci');
	const digits = scaled < 100 ? 2 : 1;
	return `${sign}${scaled.toFixed(digits)}${SUFFIXES[group]}`;
};

export const formatTime = (seconds) => {
	const s = Math.max(0, Math.floor(seconds));
	if (s < 60) return `${s}s`;
	const m = Math.floor(s / 60);
	if (m < 60) return `${m}m ${s % 60}s`;
	const h = Math.floor(m / 60);
	if (h < 24) return `${h}h ${m % 60}m`;
	const d = Math.floor(h / 24);
	return `${d}d ${h % 24}h`;
};

export const formatPct = (mult) => `${formatNumber(Math.round((mult - 1) * 100))}%`;
