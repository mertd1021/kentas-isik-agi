import "dotenv/config";
import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import admin from "firebase-admin";
import fs from "fs";
import { v2 as cloudinary } from "cloudinary";

// --- CONSTANTS ---
const PORT = process.env.PORT || 5000;
const SUPER_ADMIN_EMAIL = "mert36.demirbas@gmail.com";

// --- CONFIGURATIONS ---
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME as string,
  api_key: process.env.CLOUDINARY_API_KEY as string,
  api_secret: process.env.CLOUDINARY_API_SECRET as string,
});

const serviceAccount = JSON.parse(fs.readFileSync("./serviceAccountKey.json", "utf-8"));
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const pool = new pg.Pool({ 
  connectionString: process.env.DATABASE_URL as string,
  ssl: { rejectUnauthorized: false } 
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const app = express();

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json({ limit: '10mb' }));

// --- INTERFACES ---
interface CustomRequest extends Request {
  user?: admin.auth.DecodedIdToken;
}

// --- MIDDLEWARES ---
const verifyAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ hata: "Erişim reddedildi. Güvenlik kartı bulunamadı." });
    return;
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    res.status(401).json({ hata: "Geçersiz token formatı." });
    return;
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    (req as CustomRequest).user = decodedToken; 
    next(); 
  } catch (error) {
    console.error("Token Doğrulama Hatası:", error);
    res.status(403).json({ hata: "Geçersiz veya süresi dolmuş yetki belgesi." });
  }
};

// --- ROUTES ---
app.get("/", (req: Request, res: Response) => {
  res.json({ mesaj: "Kentaş API Sorunsuz Çalışıyor! 🚀" });
});

// --- SETTINGS ROUTES ---
app.get("/api/settings", async (req: Request, res: Response) => {
  try {
    let settings = await prisma.settings.findFirst();
    if (!settings) {
      settings = await prisma.settings.create({ data: {} });
    }
    res.json(settings);
  } catch (error) {
    console.error("Ayarlar Çekme Hatası:", error);
    res.status(500).json({ hata: "Ayarlar çekilemedi." });
  }
});

app.put("/api/settings", verifyAdmin, async (req: Request, res: Response) => {
  try {
    const updated = await prisma.settings.update({
      where: { id: 1 },
      data: req.body
    });
    res.json(updated);
  } catch (error) {
    console.error("Ayarlar Güncelleme Hatası:", error);
    res.status(500).json({ hata: "Ayarlar güncellenemedi." });
  }
});

// --- MARKER ROUTES (PUBLIC) ---
app.get("/api/markers", async (req: Request, res: Response) => {
  try {
    const markers = await prisma.marker.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(markers);
  } catch (error) {
    console.error("Veri Çekme Hatası:", error);
    res.status(500).json({ hata: "Veriler çekilemedi." });
  }
});

app.post("/api/markers", async (req: Request, res: Response): Promise<void> => {
  try {
    const { lat, lng, description, contactInfo, street, neighborhood, status, eta, imageData, isTest } = req.body;
    let finalImageUrl: string | null = imageData ? String(imageData) : null;

    if (finalImageUrl && finalImageUrl.startsWith("data:image")) {
      try {
        const uploadResponse = await cloudinary.uploader.upload(finalImageUrl, {
          folder: "kentas_arizalar",
        });
        finalImageUrl = uploadResponse.secure_url; 
      } catch (uploadError) {
        console.error("Cloudinary Yükleme Hatası:", uploadError);
        res.status(500).json({ hata: "Fotoğraf buluta yüklenemedi." });
        return; 
      }
    }

    const newMarker = await prisma.marker.create({
      data: {
        lat: Number(lat),
        lng: Number(lng),
        description: description ? String(description) : null,
        contactInfo: contactInfo ? String(contactInfo) : null,
        street: street ? String(street) : null,
        neighborhood: neighborhood ? String(neighborhood) : null,
        status: status ? String(status) : "İncelemede",
        eta: eta ? String(eta) : "Belirlenmedi",
        imageData: finalImageUrl, 
        isTest: Boolean(isTest)
      }
    });
    res.status(201).json(newMarker);
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("❌ Kayıt Oluşturma Hatası:", error.message);
      res.status(500).json({ hata: "Kayıt oluşturulamadı.", detay: error.message });
    } else {
      console.error("❌ Bilinmeyen Hata:", error);
      res.status(500).json({ hata: "Kayıt oluşturulamadı." });
    }
  }
});

// --- MARKER ROUTES (ADMIN) ---
app.put("/api/markers/:id", verifyAdmin, async (req: Request, res: Response) => {
  try {
    const updatedMarker = await prisma.marker.update({
      where: { id: req.params.id as string },
      data: req.body
    });
    res.json(updatedMarker);
  } catch (error) {
    console.error("Güncelleme Hatası:", error);
    res.status(500).json({ hata: "Güncelleme başarısız." });
  }
});

app.delete("/api/markers/:id", verifyAdmin, async (req: Request, res: Response) => {
  try {
    await prisma.marker.delete({ where: { id: req.params.id as string } });
    res.json({ mesaj: "Kayıt başarıyla silindi." });
  } catch (error) {
    console.error("Silme Hatası:", error);
    res.status(500).json({ hata: "Silme işlemi başarısız." });
  }
});

// --- ADMIN MANAGEMENT ROUTES ---
app.get("/api/admins", verifyAdmin, async (req: Request, res: Response) => {
  try {
    const admins = await prisma.admin.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(admins);
  } catch (error) {
    console.error("Admin Çekme Hatası:", error);
    res.status(500).json({ hata: "Yöneticiler çekilemedi." });
  }
});

app.post("/api/admins", verifyAdmin, async (req: Request, res: Response) => {
  try {
    const { name, email, password, role } = req.body;
    const newAdmin = await prisma.admin.create({
      data: { 
        name: String(name), 
        email: String(email), 
        password: password ? String(password) : "hidden", 
        role: role ? String(role) : "Yönetici" 
      }
    });
    res.status(201).json(newAdmin);
  } catch (error) {
    console.error("Admin Ekleme Hatası:", error);
    res.status(500).json({ hata: "Yönetici eklenemedi." });
  }
});

app.delete("/api/admins/:id", verifyAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body; 
    const requestingUser = (req as CustomRequest).user; 

    const reqEmail = requestingUser?.email?.trim().toLowerCase();
    const targetEmail = email?.trim().toLowerCase();
    const superAdminEmail = SUPER_ADMIN_EMAIL.trim().toLowerCase();

    if (reqEmail !== superAdminEmail) {
      res.status(403).json({ hata: "Yetkisiz işlem! Yalnızca Kurucu Yönetici silme işlemi yapabilir." });
      return;
    }

    if (targetEmail === superAdminEmail) {
      res.status(403).json({ hata: "Kurucu Yönetici (Sistem Sahibi) silinemez!" });
      return;
    }

    try {
      const userRecord = await admin.auth().getUserByEmail(email);
      await admin.auth().deleteUser(userRecord.uid);
      console.log(`✅ Firebase'den ${email} silindi.`);
    } catch (error: unknown) { 
      const firebaseErr = error as { code?: string };
      if (firebaseErr.code !== 'auth/user-not-found') {
        throw error; 
      }
      console.log(`⚠️ Uyarı: ${email} Firebase'de bulunamadı, DB silme işlemine devam ediliyor.`);
    }

    await prisma.admin.delete({ where: { id: req.params.id as string } });
    
    res.json({ mesaj: "Yönetici sistemden ve Firebase'den tamamen silindi." });
  } catch (error) {
    console.error("Admin Silme Hatası:", error);
    res.status(500).json({ hata: "Yönetici silinemedi." });
  }
});

// --- SERVER START ---
app.listen(PORT, () => {
  console.log(`🚀 API Server running on port ${PORT}`);
});