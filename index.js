const express = require('express');
const axios = require('axios');
const cors = require('cors');
const CryptoJS = require('crypto-js');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Fungsi sakti untuk menghitung cookie __test secara otomatis
function computeTestCookie(html) {
    try {
        const aMatch = html.match(/a=toNumbers\("([a-f0-9]+)"\)/);
        const bMatch = html.match(/b=toNumbers\("([a-f0-9]+)"\)/);
        const cMatch = html.match(/c=toNumbers\("([a-f0-9]+)"\)/);

        if (!aMatch || !bMatch || !cMatch) return null;

        const a = CryptoJS.enc.Hex.parse(aMatch[1]);
        const b = CryptoJS.enc.Hex.parse(bMatch[1]);
        const c = CryptoJS.enc.Hex.parse(cMatch[1]);

        const decrypted = CryptoJS.AES.decrypt(
            { ciphertext: c },
            a,
            { iv: b, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.NoPadding }
        );

        return decrypted.toString(CryptoJS.enc.Hex);
    } catch (e) {
        console.error("Gagal hitung AES:", e);
        return null;
    }
}

// Reusable function untuk fetch ke InfinityFree dengan Bypass AES
async function fetchWithBypass(url) {
    // STEP 1: Pancing Satpam
    const firstResponse = await axios.get(url, {
        headers: { 'User-Agent': USER_AGENT }
    });

    // Jika kena blokir Satpam (dapat HTML)
    if (typeof firstResponse.data === 'string' && firstResponse.data.includes('toNumbers')) {
        const calculatedCookie = computeTestCookie(firstResponse.data);
        if (!calculatedCookie) throw new Error("Gagal bypass AES");

        console.log("Bypass Berhasil! Menuju:", url);

        // STEP 2: Tembak ulang pakai Cookie
        const secondResponse = await axios.get(url, {
            headers: {
                'User-Agent': USER_AGENT,
                'Cookie': `__test=${calculatedCookie}`,
                'Accept': 'application/json'
            }
        });
        return secondResponse.data;
    }
    return firstResponse.data;
}

// --- ENDPOINT 1: DAFTAR SEMUA LAGU ---
app.get('/api/songs', async (req, res) => {
    try {
        const data = await fetchWithBypass('https://bimachord.free.nf/api/songs');
        res.json(data);
    } catch (error) {
        console.error("Error Songs:", error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// --- ENDPOINT 2: DETAIL LAGU BERDASARKAN SLUG ---
app.get('/api/songs/:slug', async (req, res) => {
    const slug = req.params.slug;
    const targetUrl = `https://bimachord.free.nf/api/songs/${slug}`;
    
    try {
        console.log(`Mengambil detail lagu: ${slug}`);
        const data = await fetchWithBypass(targetUrl);
        res.json(data);
    } catch (error) {
        console.error(`Error Slug (${slug}):`, error.message);
        res.status(500).json({ 
            status: 'error', 
            message: `Gagal mengambil data lagu dengan slug: ${slug}` 
        });
    }
});

app.listen(PORT, () => {
    console.log(`Hacker Proxy Otomatis di http://localhost:${PORT}`);
    console.log(`Endpoint 1: http://localhost:${PORT}/api/songs`);
    console.log(`Endpoint 2: http://localhost:${PORT}/api/songs/mori-kese-785`);
});