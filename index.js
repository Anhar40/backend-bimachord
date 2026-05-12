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

// --- PERBAIKAN FUNGSI GET ALL SONGS ---
async function getAllSongs() {
    const targetUrl = `https://bimachord.free.nf/api/songs`; 
    try {
        const data = await fetchWithBypass(targetUrl);
        
        // DEBUG: Lihat di terminal, apakah data.data, data.songs, atau langsung array?
        // console.log("Isi Data API:", data); 

        // Cek berbagai kemungkinan struktur JSON
        if (Array.isArray(data)) {
            return data;
        } else if (data && Array.isArray(data.data)) {
            return data.data; // Biasanya Laravel atau API standar membungkus di 'data'
        } else if (data && Array.isArray(data.songs)) {
            return data.songs; // Jika dibungkus di 'songs'
        } else {
            console.error("Struktur data tidak dikenali atau kosong:", data);
            return [];
        }
    } catch (error) {
        console.error("Gagal mengambil daftar lagu untuk sitemap:", error.message);
        return [];
    }
}

// --- ENDPOINT SITEMAP ---
app.get('/sitemap.xml', async (req, res) => {
    const mainDomain = 'https://bimachord.github.io';
    
    try {
        const songs = await getAllSongs();

        let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url>
        <loc>${mainDomain}/</loc>
        <changefreq>daily</changefreq>
        <priority>1.0</priority>
    </url>`;

        if (songs.length > 0) {
            songs.forEach(song => {
                // Pastikan song.slug ada agar tidak error
                if (song.slug) {
                    xml += `
    <url>
        <loc>${mainDomain}/lagu/lirik.html?slug=${song.slug}</loc>
        <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.8</priority>
    </url>`;
                }
            });
        }

        xml += `\n</urlset>`;

        res.header('Content-Type', 'application/xml');
        res.status(200).send(xml);
    } catch (err) {
        res.status(500).send("Error generating sitemap");
    }
});

app.get('/share/:slug', async (req, res) => {
    const { slug } = req.params;
    const apiUri = `https://bimachord.free.nf/api/songs/${slug}`;
    const destination = `https://bimachord.github.io/lagu/lirik.html?slug=${slug}`;

    try {
        const response = await fetchWithBypass(apiUri);
        const song = response.data && response.data[0] ? response.data[0] : null;

        if (!song) return res.redirect(destination);

        const title = `Chord ${song.title} - ${song.singer}`;
        const desc = `Lirik dan Kunci Gitar lagu Bima ${song.title}. Mainkan musik daerah Bima di BimaChord.`;

        // Kirim HANYA meta tag dan script redirect
        res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>${title}</title>
    <meta name="description" content="${desc}">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${desc}">
    <meta property="og:image" content="https://bimachord.github.io/assets/img/og-image.jpg">
    <meta property="og:url" content="${destination}">
    <meta property="og:type" content="article">
    <meta name="twitter:card" content="summary_large_image">
    <script>window.location.replace("${destination}");</script>
</head>
<body></body>
</html>
        `);
    } catch (error) {
        res.redirect(destination);
    }
});

app.listen(PORT, () => {
    console.log(`Hacker Proxy Otomatis di http://localhost:${PORT}`);
    console.log(`Endpoint 1: http://localhost:${PORT}/api/songs`);
    console.log(`Endpoint 2: http://localhost:${PORT}/api/songs/mori-kese-785`);
});