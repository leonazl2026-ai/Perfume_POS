import { PrismaClient, SaleLineType } from "@prisma/client";
import { calcCostPerMl } from "../src/lib/pricing";
import { hashPassword } from "../src/lib/password";
import { PERMISSIONS, serializePermissions } from "../src/lib/permissions";

const prisma = new PrismaClient();

interface SeedVariant {
  batchId: string;
  product: string;
  brand: string;
  sizeMl: number;
  bottleCost: number;
  vialCost: number;
  bottlePrice: number;
  unopenedBottles: number;
  activeMl: number;
  decants: { sizeMl: number; price: number }[];
}

const SEED_VARIANTS: SeedVariant[] = [
  {
    batchId: "BDC100-B01",
    product: "Bleu de Chanel EDP",
    brand: "Chanel",
    sizeMl: 100,
    bottleCost: 120,
    vialCost: 0.8,
    bottlePrice: 185,
    unopenedBottles: 4,
    activeMl: 100,
    decants: [
      { sizeMl: 5, price: 14 },
      { sizeMl: 10, price: 25 },
    ],
  },
  {
    batchId: "SAUV-B02",
    product: "Sauvage Elixir",
    brand: "Dior",
    sizeMl: 60,
    bottleCost: 145,
    vialCost: 0.8,
    bottlePrice: 215,
    unopenedBottles: 3,
    activeMl: 60,
    decants: [
      { sizeMl: 5, price: 22 },
      { sizeMl: 10, price: 40 },
    ],
  },
  {
    batchId: "OUDW-B01",
    product: "Oud Wood",
    brand: "Tom Ford",
    sizeMl: 50,
    bottleCost: 210,
    vialCost: 1.0,
    bottlePrice: 320,
    unopenedBottles: 2,
    activeMl: 50,
    decants: [
      { sizeMl: 5, price: 32 },
      { sizeMl: 10, price: 58 },
    ],
  },
];

/** The 7 categories from Perfume_POS_Master_Final_2.1.xlsx, in sheet order. */
const EXPENSE_CATEGORIES: { name: string; description: string }[] = [
  {
    name: "Packing Supplies",
    description: "Packing boxes, Bubble wrap, Tape, Thermal labels, Shredded paper",
  },
  {
    name: "Decant Supplies",
    description:
      "Syringes/Needles, Test strips, Alcohol, Cotton pads, Pipettes, Mini label stickers",
  },
  {
    name: "Marketing Cost",
    description: "Facebook/TikTok Ads, KOL gifting, Logo/Photographer, Free samples",
  },
  {
    name: "Delivery Cost",
    description: "Free shipping absorbed, Supplier delivery/car gate fees",
  },
  {
    name: "Office Supplies",
    description: "Stationery, Receipt books, WiFi/Mobile data, Small office repairs",
  },
  {
    name: "Loss & Damaged",
    description: "Spillage during decanting, Broken bottles, Damaged/lost in transit",
  },
  {
    name: "Miscellaneous Expense",
    description: "Tips, Cash rounding loss, Banking/transfer fees",
  },
];

async function seedExpenseCategories() {
  // Upserted by name so re-running the seed never duplicates or wipes history.
  for (const [index, category] of EXPENSE_CATEGORIES.entries()) {
    await prisma.expenseCategory.upsert({
      where: { name: category.name },
      create: { ...category, sortOrder: index },
      update: { description: category.description, sortOrder: index },
    });
  }
  console.log(`Synced ${EXPENSE_CATEGORIES.length} expense categories.`);
}

/** Defaults for the tunable thresholds; safe to re-run. */
async function seedSettings() {
  const defaults: Record<string, string> = {
    lowStockBottles: "2",
    lowStockMl: "15",
    tierRegularSpend: "150000",
    tierRegularOrders: "3",
    tierVipSpend: "500000",
    tierVipOrders: "10",
    slowMovingDays: "60",
    loyaltyEnabled: "1",
    earnRateAmount: "1000",
    pointsEarnedPerRate: "1",
    redeemPointValue: "10",
  };

  for (const [key, value] of Object.entries(defaults)) {
    // create-only: never stomp a value the admin has changed.
    await prisma.setting.upsert({ where: { key }, create: { key, value }, update: {} });
  }
}

/**
 * Default administrator. Created only when no user exists, so re-seeding
 * never resets a password the shop has already changed.
 */
async function seedAdminUser() {
  const existing = await prisma.user.count();
  if (existing > 0) {
    console.log("Users already exist — skipping default admin.");
    return;
  }

  const username = process.env.SEED_ADMIN_USERNAME ?? "admin";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "adminpassword";

  await prisma.user.create({
    data: {
      name: "Administrator",
      username: username.toLowerCase(),
      passwordHash: await hashPassword(password),
      role: "ADMIN",
      // ADMIN implies everything, but the list is stored too so the editor
      // shows the boxes ticked.
      permissions: serializePermissions([...PERMISSIONS]),
    },
  });

  console.log(`Created admin account "${username}".`);
  console.warn("⚠  Change this password immediately under Admin → Users.");
}

async function main() {
  console.log("Seeding database…");

  await seedExpenseCategories();
  await seedSettings();
  await seedAdminUser();

  // Sample inventory is created only on a fresh database.
  if ((await prisma.product.count()) > 0) {
    console.log("Products already exist — skipping sample inventory.");
    return;
  }

  const supplier = await prisma.supplier.create({
    data: {
      name: "Sample Importer",
      phone: "09000000000",
      notes: "Seed data — replace with your real supplier.",
    },
  });

  for (const seed of SEED_VARIANTS) {
    const product = await prisma.product.create({
      data: { name: seed.product, brand: seed.brand },
    });

    await prisma.productVariant.create({
      data: {
        variantBatchId: seed.batchId,
        productId: product.id,
        supplierId: supplier.id,
        fullBottleSizeMl: seed.sizeMl,
        bottleCost: seed.bottleCost,
        vialCost: seed.vialCost,
        costPerMl: calcCostPerMl(seed.bottleCost, seed.sizeMl),
        fullBottleSellingPrice: seed.bottlePrice,
        unopenedBottles: seed.unopenedBottles,
        decantActiveRemainingMl: seed.activeMl,
        purchaseDate: new Date(),
        decantOptions: {
          create: seed.decants.map((d) => ({ sizeMl: d.sizeMl, sellingPrice: d.price })),
        },
      },
    });
  }

  // "3x10ml Discovery Set" — one 10ml decant from each of the three batches.
  const variants = await prisma.productVariant.findMany();
  await prisma.bundle.create({
    data: {
      name: "3x10ml Discovery Set",
      sku: "BND-DISC-3X10",
      description: "Three 10ml decants — Bleu de Chanel, Sauvage Elixir, Oud Wood.",
      sellingPrice: 110,
      items: {
        create: variants.map((v) => ({
          productVariantId: v.id,
          itemType: SaleLineType.DECANT,
          decantSizeMl: 10,
          quantity: 1,
        })),
      },
    },
  });

  console.log(`Seeded ${SEED_VARIANTS.length} batches and 1 bundle.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
