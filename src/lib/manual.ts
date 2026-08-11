import type { Language } from "@/lib/i18n";

/**
 * Operational documentation, held as data so the page can filter, print and
 * switch language without duplicating markup.
 */

export interface ManualStep {
  en: string;
  mm: string;
}

export interface ManualTopic {
  heading: ManualStep;
  steps: ManualStep[];
  /** Rendered as a callout — the things that cause real mistakes. */
  note?: ManualStep;
}

export interface ManualSection {
  id: string;
  title: ManualStep;
  summary: ManualStep;
  topics: ManualTopic[];
}

export const pick = (value: ManualStep, lang: Language): string =>
  lang === "mm" ? value.mm : value.en;

export const MANUAL_SECTIONS: ManualSection[] = [
  {
    id: "pos",
    title: { en: "1. POS Operations", mm: "၁။ အရောင်းစနစ် လုပ်ငန်းစဉ်" },
    summary: {
      en: "Ringing up a sale, finding products fast, and handling repeat customers.",
      mm: "အရောင်းပြုလုပ်ခြင်း၊ ပစ္စည်းအမြန်ရှာဖွေခြင်းနှင့် ပုံမှန်ဝယ်ယူသူများ ကိုင်တွယ်ခြင်း။",
    },
    topics: [
      {
        heading: { en: "Grid view vs List view", mm: "ကွက်ပုံစံ နှင့် စာရင်းပုံစံ" },
        steps: [
          {
            en: "Use the two icons at the top right of the product panel to switch between Grid (cards) and List (dense table).",
            mm: "ပစ္စည်းအကွက်၏ ညာဘက်အပေါ်ထောင့်ရှိ အိုင်ကွန်နှစ်ခုဖြင့် ကွက်ပုံစံနှင့် စာရင်းပုံစံ ပြောင်းလဲနိုင်သည်။",
          },
          {
            en: "List view shows Brand, Product, Batch ID, live stock and every decant size as a one-tap button — best for busy periods.",
            mm: "စာရင်းပုံစံတွင် ကုန်အမှတ်တံဆိပ်၊ ပစ္စည်းအမည်၊ ဘက်ချ်နံပါတ်၊ လက်ကျန်စတော့နှင့် ဒီကန့်အရွယ်အစားများကို တစ်ချက်နှိပ်ရုံဖြင့် ထည့်နိုင်သည်။",
          },
          {
            en: "Your choice is remembered on that device until you change it.",
            mm: "ရွေးချယ်မှုကို ပြောင်းလဲသည်အထိ ထိုစက်တွင် မှတ်ထားပေးသည်။",
          },
        ],
      },
      {
        heading: { en: "Searching products", mm: "ပစ္စည်း ရှာဖွေခြင်း" },
        steps: [
          {
            en: "The search box matches product name, brand, or Batch ID.",
            mm: "ရှာဖွေမှုအကွက်တွင် ပစ္စည်းအမည်၊ ကုန်အမှတ်တံဆိပ် သို့မဟုတ် ဘက်ချ်နံပါတ်ဖြင့် ရှာနိုင်သည်။",
          },
          {
            en: "Use the tabs (All / Full Bottles / Decants / Bundles) to narrow what is shown.",
            mm: "အားလုံး / ပုလင်းအပြည့် / ဒီကန့် / အစုံလိုက် တက်ဘ်များဖြင့် စစ်ထုတ်ကြည့်နိုင်သည်။",
          },
          {
            en: "Greyed-out buttons mean the cart already claims the remaining stock for that batch.",
            mm: "မီးခိုးရောင်ဖြစ်နေသော ခလုတ်များသည် ထိုဘက်ချ်၏ လက်ကျန်ကို ခြင်းထဲတွင် ယူထားပြီးဖြစ်ကြောင်း ပြသည်။",
          },
        ],
      },
      {
        heading: { en: "Customer lookup by phone", mm: "ဖုန်းနံပါတ်ဖြင့် ဝယ်ယူသူ ရှာဖွေခြင်း" },
        steps: [
          {
            en: "Start typing a name or phone number in the cart — matching customers appear below the field.",
            mm: "ခြင်းအကွက်တွင် အမည် သို့မဟုတ် ဖုန်းနံပါတ် စတင်ရိုက်ပါ — ကိုက်ညီသော ဝယ်ယူသူများ ပေါ်လာမည်။",
          },
          {
            en: "Selecting one fills in their phone, channel and saved address, and shows their loyalty balance.",
            mm: "တစ်ဦးကို ရွေးလိုက်လျှင် ဖုန်းနံပါတ်၊ ရင်းမြစ်နှင့် သိမ်းထားသော လိပ်စာများ အလိုအလျောက် ဖြည့်ပေးပြီး အမှတ်လက်ကျန်ကို ပြသည်။",
          },
          {
            en: "A customer record is created automatically whenever a sale records a phone number.",
            mm: "အရောင်းတွင် ဖုန်းနံပါတ် ထည့်သွင်းတိုင်း ဝယ်ယူသူမှတ်တမ်း အလိုအလျောက် ဖန်တီးပေးသည်။",
          },
        ],
        note: {
          en: "Selecting a customer fills their address but does NOT tick Delivery order. That stays your decision.",
          mm: "ဝယ်ယူသူရွေးလျှင် လိပ်စာဖြည့်ပေးသော်လည်း အိမ်ရောက်ပို့ဆောင်မှုကို အလိုအလျောက် အမှန်ခြစ်မပေးပါ။ ၎င်းမှာ သင့်ဆုံးဖြတ်ချက်သာ ဖြစ်သည်။",
        },
      },
      {
        heading: { en: "Redeeming loyalty points", mm: "သစ္စာစောင့်သိမှု အမှတ်များ အသုံးပြုခြင်း" },
        steps: [
          {
            en: "Once a customer is selected, the amber Loyalty panel shows their balance and what it is worth in Ks.",
            mm: "ဝယ်ယူသူရွေးပြီးလျှင် အဝါရောင်အကွက်တွင် အမှတ်လက်ကျန်နှင့် ကျပ်တန်ဖိုးကို ပြသည်။",
          },
          {
            en: "Type the points to redeem, or press Max to apply everything the order allows.",
            mm: "အသုံးပြုလိုသော အမှတ်ကို ရိုက်ထည့်ပါ၊ သို့မဟုတ် အများဆုံး ခလုတ်ကို နှိပ်ပါ။",
          },
          {
            en: "The discount appears as its own line, separate from any manual discount.",
            mm: "လျှော့စျေးကို သီးခြားလိုင်းအဖြစ် ပြသပြီး လက်ဖြင့်ပေးသော လျှော့စျေးနှင့် ခွဲခြားထားသည်။",
          },
        ],
        note: {
          en: "Points can never exceed the balance or the order value. Redeemed points do not earn points back.",
          mm: "အမှတ်များသည် လက်ကျန် သို့မဟုတ် အော်ဒါတန်ဖိုးထက် မကျော်လွန်နိုင်ပါ။ အသုံးပြုပြီးသော အမှတ်များအတွက် အမှတ်ပြန်မရပါ။",
        },
      },
      {
        heading: { en: "Walk-in vs Delivery", mm: "ဆိုင်တွင်ဝယ် နှင့် အိမ်ရောက်ပို့ဆောင်" },
        steps: [
          {
            en: "Leave Delivery order unticked for counter sales. The order is marked Completed and no delivery slip prints.",
            mm: "ဆိုင်တွင်ဝယ်ယူမှုအတွက် အိမ်ရောက်ပို့ဆောင်မှုကို အမှန်မခြစ်ပါနှင့်။ ပြီးဆုံးပြီအဖြစ် မှတ်သားပြီး ပို့ဆောင်မှုစာရွက် မထုတ်ပါ။",
          },
          {
            en: "Tick Delivery order to capture address, courier and waybill. The sale enters the fulfilment queue as Pending.",
            mm: "အိမ်ရောက်ပို့ဆောင်မှုကို အမှန်ခြစ်ပါက လိပ်စာ၊ ပို့ဆောင်ရေးနှင့် ပို့ဆောင်မှုနံပါတ် ထည့်နိုင်သည်။ စောင့်ဆိုင်းဆဲအဖြစ် မှတ်သားမည်။",
          },
          {
            en: "Track and update those orders under Sales & Reports, singly or in bulk.",
            mm: "အဆိုပါအော်ဒါများကို အရောင်းနှင့် အစီရင်ခံစာတွင် တစ်ခုချင်း သို့မဟုတ် အစုလိုက် ပြင်ဆင်နိုင်သည်။",
          },
        ],
      },
    ],
  },
  {
    id: "stock",
    title: { en: "2. Products & Stock", mm: "၂။ ပစ္စည်းနှင့် စတော့" },
    summary: {
      en: "Creating batches, opening bottles for decanting, and correcting stock.",
      mm: "ဘက်ချ်များ ဖန်တီးခြင်း၊ ဒီကန့်ခွဲရန် ပုလင်းဖွင့်ခြင်းနှင့် စတော့ပြင်ဆင်ခြင်း။",
    },
    topics: [
      {
        heading: { en: "Adding a new batch", mm: "ဘက်ချ်အသစ် ထည့်သွင်းခြင်း" },
        steps: [
          {
            en: "Products & Stock → + New Batch. Pick an existing product or create a new one.",
            mm: "ပစ္စည်းနှင့် စတော့ → ဘက်ချ်အသစ်။ ရှိပြီးသား ပစ္စည်းရွေးပါ သို့မဟုတ် အသစ်ဖန်တီးပါ။",
          },
          {
            en: "Give the batch a unique Batch ID, choose a supplier, and enter bottle size, bottle cost, vial cost and selling price.",
            mm: "ဘက်ချ်နံပါတ် သီးသန့်ပေးပါ၊ ပစ္စည်းပေးသွင်းသူ ရွေးပါ၊ ပုလင်းအရွယ်၊ ကုန်ကျစရိတ်၊ ပုလင်းသေးစရိတ်နှင့် ရောင်းစျေး ထည့်ပါ။",
          },
          {
            en: "Add each decant size you sell with its price. Cost per ml and profit per size preview as you type.",
            mm: "ရောင်းမည့် ဒီကန့်အရွယ်တိုင်းကို စျေးနှုန်းနှင့်အတူ ထည့်ပါ။ တစ်မီလီလီတာစရိတ်နှင့် အမြတ်ကို ချက်ချင်းပြသည်။",
          },
        ],
        note: {
          en: "Opening stock can only be entered when creating a batch. After that, all stock moves through the Stock actions so the audit trail stays complete.",
          mm: "အစပိုင်းစတော့ကို ဘက်ချ်ဖန်တီးချိန်တွင်သာ ထည့်နိုင်သည်။ ထို့နောက် စတော့အပြောင်းအလဲအားလုံးကို စတော့လုပ်ဆောင်ချက်များမှတဆင့် ပြုလုပ်ရမည်။",
        },
      },
      {
        heading: { en: "Opening a bottle for decanting", mm: "ဒီကန့်ခွဲရန် ပုလင်းဖွင့်ခြင်း" },
        steps: [
          {
            en: "Row → Stock → Open 1 bottle. This moves one sealed bottle out of stock and adds its full volume to the active decant pool.",
            mm: "အတန်း → စတော့ → ပုလင်း ၁ လုံးဖွင့်။ ပိတ်ထားသောပုလင်း ၁ လုံးကို လျှော့ပြီး ၎င်း၏ ပမာဏအပြည့်ကို ဒီကန့်အတွက် ထည့်ပေးသည်။",
          },
          {
            en: "Until you do this, decants cannot be sold from that batch — active ml only ever goes down otherwise.",
            mm: "၎င်းကို မလုပ်မချင်း ထိုဘက်ချ်မှ ဒီကန့် မရောင်းနိုင်ပါ။",
          },
        ],
      },
      {
        heading: { en: "Adjusting active ml", mm: "သုံးဆဲ မီလီလီတာ ပြင်ဆင်ခြင်း" },
        steps: [
          {
            en: "Row → Stock → Adjust active ml. Enter the measured remaining volume and a reason.",
            mm: "အတန်း → စတော့ → သုံးဆဲမီလီလီတာ ပြင်ဆင်ရန်။ တိုင်းတာရရှိသော ပမာဏနှင့် အကြောင်းရင်း ထည့်ပါ။",
          },
          {
            en: "Use this for recounts. For spillage or breakage use Log loss instead, so the money is recorded too.",
            mm: "ပြန်လည်ရေတွက်မှုအတွက် သုံးပါ။ ဖိတ်စင်ခြင်း သို့မဟုတ် ကွဲအက်ခြင်းအတွက် ဆုံးရှုံးမှုမှတ်တမ်းကို သုံးပါ။",
          },
        ],
      },
    ],
  },
  {
    id: "wastage",
    title: { en: "3. Wastage Logging", mm: "၃။ ဖိတ်စင်/ပျက်စီးမှု မှတ်တမ်း" },
    summary: {
      en: "Recording loss so both the stock and the money are correct.",
      mm: "စတော့နှင့် ငွေကြေး နှစ်မျိုးလုံး မှန်ကန်စေရန် ဆုံးရှုံးမှု မှတ်တမ်းတင်ခြင်း။",
    },
    topics: [
      {
        heading: { en: "Recording a loss", mm: "ဆုံးရှုံးမှု မှတ်တမ်းတင်ခြင်း" },
        steps: [
          {
            en: "Products & Stock → row → Stock → Log loss / spillage.",
            mm: "ပစ္စည်းနှင့် စတော့ → အတန်း → စတော့ → ဆုံးရှုံးမှု မှတ်တမ်းတင်ရန်။",
          },
          {
            en: "Pick a reason: Spillage / Accident, Evaporation, Damaged / Broken Bottle, or Tester / Promotional Sample.",
            mm: "အကြောင်းရင်း ရွေးပါ — ဖိတ်စင်မှု၊ အငွေ့ပျံမှု၊ ပျက်စီး/ကွဲအက်မှု၊ သို့မဟုတ် နမူနာ။",
          },
          {
            en: "Enter the ml and/or bottles lost. The monetary loss is calculated as (ml x cost per ml) + (bottles x bottle cost).",
            mm: "ဆုံးရှုံးသော မီလီလီတာနှင့်/သို့မဟုတ် ပုလင်းအရေအတွက် ထည့်ပါ။ ငွေကြေးဆုံးရှုံးမှုကို အလိုအလျောက် တွက်ချက်ပေးသည်။",
          },
        ],
        note: {
          en: "The loss is booked automatically as an expense under Loss & Damaged. Never enter it again by hand — that would double-count it against profit.",
          mm: "ဆုံးရှုံးမှုကို ဆုံးရှုံး/ပျက်စီးမှု စရိတ်အဖြစ် အလိုအလျောက် မှတ်တမ်းတင်သည်။ လက်ဖြင့် ထပ်မံမထည့်ပါနှင့်။",
        },
      },
      {
        heading: { en: "Void / Revert a write-off", mm: "ဆုံးရှုံးမှု မှတ်တမ်း ပယ်ဖျက်ခြင်း" },
        steps: [
          {
            en: "Wastage Log → find the entry → Void / Revert, then confirm.",
            mm: "ဖိတ်စင်/ပျက်စီးမှု စာရင်း → မှတ်တမ်းရှာပါ → ပယ်ဖျက်ရန် နှိပ်ပြီး အတည်ပြုပါ။",
          },
          {
            en: "The stock goes back to the batch, the expense is removed, and net profit recovers.",
            mm: "စတော့ကို ဘက်ချ်သို့ ပြန်ထည့်ပေးပြီး စရိတ်ကို ဖယ်ရှားကာ အသားတင်အမြတ် ပြန်လည်ကောင်းမွန်လာသည်။",
          },
          {
            en: "The row stays in the list marked Voided, and stops counting toward the period total.",
            mm: "မှတ်တမ်းကို ပယ်ဖျက်ပြီးအဖြစ် ဆက်လက်ပြသပြီး စုစုပေါင်းတွင် မပါဝင်တော့ပါ။",
          },
        ],
      },
    ],
  },
  {
    id: "crm",
    title: { en: "4. CRM & Loyalty", mm: "၄။ ဝယ်ယူသူ စီမံခန့်ခွဲမှုနှင့် အမှတ်စနစ်" },
    summary: {
      en: "Customer tiers, point rates, and manual corrections.",
      mm: "ဝယ်ယူသူအဆင့်များ၊ အမှတ်နှုန်းထားများနှင့် လက်ဖြင့်ပြင်ဆင်ခြင်း။",
    },
    topics: [
      {
        heading: { en: "Customer tiers", mm: "ဝယ်ယူသူ အဆင့်များ" },
        steps: [
          {
            en: "Tiers are New, Regular and VIP. A customer reaches a tier by hitting either the spend or the order-count cutoff.",
            mm: "အဆင့်များမှာ အသစ်၊ ပုံမှန်နှင့် အထူးဝယ်ယူသူ ဖြစ်သည်။ သုံးစွဲငွေ သို့မဟုတ် အော်ဒါအရေအတွက် တစ်ခုခုပြည့်မီလျှင် အဆင့်တက်သည်။",
          },
          {
            en: "Cutoffs are set in Settings. Tiers are recalculated after each sale.",
            mm: "သတ်မှတ်ချက်များတွင် ပြင်ဆင်နိုင်သည်။ အရောင်းတိုင်းပြီးနောက် အဆင့်ကို ပြန်တွက်သည်။",
          },
          {
            en: "To fix a customer at one tier, open their profile, tick Pin, and choose the tier.",
            mm: "ဝယ်ယူသူတစ်ဦးကို အဆင့်တစ်ခုတည်းတွင် ထားလိုပါက ပရိုဖိုင်ဖွင့်၊ Pin အမှန်ခြစ်ပြီး အဆင့်ရွေးပါ။",
          },
        ],
      },
      {
        heading: { en: "Point rates", mm: "အမှတ် နှုန်းထားများ" },
        steps: [
          {
            en: "Settings → Loyalty system. Set how much spend earns how many points, and what one point is worth in Ks.",
            mm: "သတ်မှတ်ချက်များ → အမှတ်စနစ်။ မည်မျှသုံးစွဲလျှင် အမှတ်မည်မျှရမည်နှင့် အမှတ်တစ်ခု၏ ကျပ်တန်ဖိုးကို သတ်မှတ်ပါ။",
          },
          {
            en: "Points are earned on the amount actually paid, excluding tax.",
            mm: "အမှတ်များကို အခွန်မပါဘဲ အမှန်တကယ်ပေးချေသော ပမာဏအပေါ် တွက်ချက်ပေးသည်။",
          },
          {
            en: "Turning the system off keeps existing balances but stops earning and redemption.",
            mm: "စနစ်ကို ပိတ်လျှင် လက်ကျန်များ ဆက်ရှိနေမည် ဖြစ်သော်လည်း အမှတ်ရရှိမှုနှင့် အသုံးပြုမှု ရပ်တန့်မည်။",
          },
        ],
      },
      {
        heading: { en: "Manual point adjustments", mm: "အမှတ် လက်ဖြင့် ပြင်ဆင်ခြင်း" },
        steps: [
          {
            en: "Customers → Points column or the Points action → add or deduct with a reason.",
            mm: "ဝယ်ယူသူများ → အမှတ်ကော်လံ သို့မဟုတ် အမှတ်ခလုတ် → အကြောင်းရင်းနှင့်အတူ ထည့်ရန်/နုတ်ရန်။",
          },
          {
            en: "Every movement is kept in the point history, including sale earnings, redemptions and reversals.",
            mm: "အပြောင်းအလဲတိုင်းကို အမှတ်မှတ်တမ်းတွင် သိမ်းဆည်းထားသည်။",
          },
          {
            en: "Voiding a sale automatically reverses both the points earned and the points redeemed on it.",
            mm: "အရောင်းတစ်ခုကို ပယ်ဖျက်လျှင် ရရှိထားသော အမှတ်နှင့် အသုံးပြုထားသော အမှတ် နှစ်မျိုးလုံးကို အလိုအလျောက် ပြန်လည်ပြင်ဆင်ပေးသည်။",
          },
        ],
      },
    ],
  },
  {
    id: "sales",
    title: { en: "5. Sales & Traceability", mm: "၅။ အရောင်းနှင့် ခြေရာခံမှု" },
    summary: {
      en: "Reviewing history, tracing batches, and reading the profit figures.",
      mm: "မှတ်တမ်းပြန်ကြည့်ခြင်း၊ ဘက်ချ်ခြေရာခံခြင်းနှင့် အမြတ်ကိန်းဂဏန်းများ ဖတ်ရှုခြင်း။",
    },
    topics: [
      {
        heading: { en: "Reviewing sales history", mm: "အရောင်းမှတ်တမ်း ပြန်လည်သုံးသပ်ခြင်း" },
        steps: [
          {
            en: "Sales & Reports lists every order for the chosen date range. Search by sale number, customer or tracking number.",
            mm: "အရောင်းနှင့် အစီရင်ခံစာတွင် ရွေးချယ်ထားသော ရက်အပိုင်းအခြားအတွင်း အော်ဒါအားလုံး ပါဝင်သည်။",
          },
          {
            en: "Click a sale to see its line items, costs and profit. Receipt opens a printable copy.",
            mm: "အရောင်းတစ်ခုကို နှိပ်၍ ပစ္စည်းစာရင်း၊ ကုန်ကျစရိတ်နှင့် အမြတ်ကို ကြည့်နိုင်သည်။",
          },
          {
            en: "Tick several orders to update their delivery status together.",
            mm: "အော်ဒါများစွာကို အမှန်ခြစ်ပြီး ပို့ဆောင်မှုအခြေအနေကို တစ်ပြိုင်နက် ပြင်ဆင်နိုင်သည်။",
          },
        ],
      },
      {
        heading: { en: "Batch and supplier traceability", mm: "ဘက်ချ်နှင့် ပစ္စည်းပေးသွင်းသူ ခြေရာခံခြင်း" },
        steps: [
          {
            en: "Every sold line records the batch it was poured from and that batch's supplier.",
            mm: "ရောင်းချသော ပစ္စည်းတိုင်းတွင် မည်သည့်ဘက်ချ်မှ ထုတ်ယူသည်နှင့် ပစ္စည်းပေးသွင်းသူကို မှတ်တမ်းတင်ထားသည်။",
          },
          {
            en: "Batch IDs appear under each row in history, and in full in the detail view and on the printed receipt.",
            mm: "ဘက်ချ်နံပါတ်များကို မှတ်တမ်းအတန်းအောက်၊ အသေးစိတ်စာမျက်နှာနှင့် ဘောက်ချာတွင် ဖော်ပြသည်။",
          },
          {
            en: "If a customer reports a problem, this tells you exactly which bottle and supplier it came from.",
            mm: "ဝယ်ယူသူထံမှ ပြဿနာတစ်စုံတစ်ရာရှိပါက မည်သည့်ပုလင်းနှင့် မည်သူ့ထံမှလာသည်ကို အတိအကျ သိနိုင်သည်။",
          },
        ],
      },
      {
        heading: { en: "Reading net profit", mm: "အသားတင်အမြတ် ဖတ်ရှုခြင်း" },
        steps: [
          {
            en: "Revenue minus cost of goods gives gross profit. Gross profit minus operating expenses gives net profit.",
            mm: "ရောင်းရငွေမှ ကုန်ပစ္စည်းစရိတ် နုတ်လျှင် စုစုပေါင်းအမြတ်။ ထိုမှ လုပ်ငန်းစရိတ်များ နုတ်လျှင် အသားတင်အမြတ်။",
          },
          {
            en: "Only completed sales count. Voided sales are excluded and their stock is returned.",
            mm: "ပြီးဆုံးသော အရောင်းများသာ ပါဝင်သည်။ ပယ်ဖျက်ထားသော အရောင်းများ မပါဝင်ဘဲ စတော့ကို ပြန်ထည့်ပေးသည်။",
          },
          {
            en: "Analytics breaks this down by channel, brand, decant size and payment method.",
            mm: "ခွဲခြမ်းစိတ်ဖြာချက်တွင် ရင်းမြစ်၊ ကုန်အမှတ်တံဆိပ်၊ ဒီကန့်အရွယ်နှင့် ငွေပေးချေမှုအလိုက် ခွဲခြားပြသည်။",
          },
        ],
      },
    ],
  },
];
