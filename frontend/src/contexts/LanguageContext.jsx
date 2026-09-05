import React, { createContext, useContext, useEffect, useState } from "react";

// Real i18n for the visible UI chrome (headers, sidebar, key labels).
// Languages: English, Assamese, Bengali, Hindi, Bodo. Selected language is
// persisted in localStorage and applied everywhere via t(key).
const DICT = {
  en: {
    "nav.dashboard": "Dashboard",
    "nav.consignments": "My Consignments",
    "nav.vehicles": "My Vehicles",
    "nav.tracking": "Live Tracking & GPS",
    "nav.fleet-tracking": "Vehicle Tracking",
    "nav.routes": "Route Planning",
    "nav.route-optimization": "Route Optimization",
    "nav.alerts": "Alerts",
    "nav.history": "Delivery History",
    "nav.reports": "Reports & Analytics",
    "nav.settings": "Settings",
    "nav.help": "Help & Support",
    "header.notifications": "Notifications",
    "header.markAllRead": "Mark all read",
    "header.noAlerts": "No active alerts — all clear.",
    "header.settingsProfile": "Settings & Profile",
    "header.supportHelp": "Support & Help",
    "header.signOut": "Sign Out",
    "header.addConsignment": "Add Consignment",
    "header.operator": "Transporter Operator",
    "header.subtitle": "Here's what's happening with your operations today.",
    "header.title": "Let's move every delivery forward.",
    "common.goodMorning": "Good Morning",
    "common.goodAfternoon": "Good Afternoon",
    "common.goodEvening": "Good Evening",
  },
  as: {
    "nav.dashboard": "ডেছব'ৰ্ড",
    "nav.consignments": "মোৰ কনছাইনমেন্ট",
    "nav.vehicles": "মোৰ যান-বাহন",
    "nav.tracking": "লাইভ ট্ৰেকিং আৰু জিপিএছ",
    "nav.fleet-tracking": "বাহন ট্ৰেকিং",
    "nav.routes": "ৰুট পৰিকল্পনা",
    "nav.route-optimization": "ৰুট অপ্টিমাইজেচন",
    "nav.alerts": "সতৰ্কবাণী",
    "nav.history": "ডেলিভাৰী ইতিহাস",
    "nav.reports": "ৰিপৰ্ট আৰু বিশ্লেষণ",
    "nav.settings": "ছেটিংছ",
    "nav.help": "সহায় আৰু সমৰ্থন",
    "header.notifications": "জাননী",
    "header.markAllRead": "সকলো পঢ়া বুলি চিন দিয়ক",
    "header.noAlerts": "কোনো সক্ৰিয় সতৰ্কবাণী নাই — সকলো ঠিক আছে।",
    "header.settingsProfile": "ছেটিংছ আৰু প্ৰফাইল",
    "header.supportHelp": "সহায় আৰু সমৰ্থন",
    "header.signOut": "লগ আউট",
    "header.addConsignment": "কনছাইনমেন্ট যোগ কৰক",
    "header.operator": "পৰিবহণ অপাৰেটৰ",
    "header.subtitle": "আজি আপোনাৰ কাৰ্যকলাপত কি হৈ আছে।",
    "header.title": "প্ৰতিটো ডেলিভাৰী আগুৱাই নিওঁ।",
    "common.goodMorning": "শুভ ৰাতিপুৱা",
    "common.goodAfternoon": "শুভ আবেলি",
    "common.goodEvening": "শুভ সন্ধ্যা",
  },
  bn: {
    "nav.dashboard": "ড্যাশবোর্ড",
    "nav.consignments": "আমার কনসাইনমেন্ট",
    "nav.vehicles": "আমার যানবাহন",
    "nav.tracking": "লাইভ ট্র্যাকিং ও জিপিএস",
    "nav.fleet-tracking": "যানবাহন ট্র্যাকিং",
    "nav.routes": "রুট পরিকল্পনা",
    "nav.route-optimization": "রুট অপটিমাইজেশন",
    "nav.alerts": "সতর্কতা",
    "nav.history": "ডেলিভারি ইতিহাস",
    "nav.reports": "রিপোর্ট ও বিশ্লেষণ",
    "nav.settings": "সেটিংস",
    "nav.help": "সহায়তা ও সমর্থন",
    "header.notifications": "বিজ্ঞপ্তি",
    "header.markAllRead": "সব পঠিত হিসেবে চিহ্নিত করুন",
    "header.noAlerts": "কোনো সক্রিয় সতর্কতা নেই — সব ঠিক আছে।",
    "header.settingsProfile": "সেটিংস ও প্রোফাইল",
    "header.supportHelp": "সহায়তা ও সমর্থন",
    "header.signOut": "লগ আউট",
    "header.addConsignment": "কনসাইনমেন্ট যোগ করুন",
    "header.operator": "পরিবহন অপারেটর",
    "header.subtitle": "আজ আপনার কার্যক্রমে যা ঘটছে।",
    "header.title": "প্রতিটি ডেলিভারি এগিয়ে নিয়ে যাই।",
    "common.goodMorning": "শুভ সকাল",
    "common.goodAfternoon": "শুভ অপরাহ্ন",
    "common.goodEvening": "শুভ সন্ধ্যা",
  },
  hi: {
    "nav.dashboard": "डैशबोर्ड",
    "nav.consignments": "मेरे कंसाइनमेंट",
    "nav.vehicles": "मेरे वाहन",
    "nav.tracking": "लाइव ट्रैकिंग और जीपीएस",
    "nav.fleet-tracking": "वाहन ट्रैकिंग",
    "nav.routes": "रूट योजना",
    "nav.route-optimization": "रूट ऑप्टिमाइज़ेशन",
    "nav.alerts": "चेतावनियाँ",
    "nav.history": "डिलीवरी इतिहास",
    "nav.reports": "रिपोर्ट और विश्लेषण",
    "nav.settings": "सेटिंग्स",
    "nav.help": "सहायता और समर्थन",
    "header.notifications": "सूचनाएँ",
    "header.markAllRead": "सभी पढ़ी हुई चिह्नित करें",
    "header.noAlerts": "कोई सक्रिय चेतावनी नहीं — सब ठीक है।",
    "header.settingsProfile": "सेटिंग्स और प्रोफ़ाइल",
    "header.supportHelp": "सहायता और समर्थन",
    "header.signOut": "साइन आउट",
    "header.addConsignment": "कंसाइनमेंट जोड़ें",
    "header.operator": "परिवहन संचालक",
    "header.subtitle": "आज आपके संचालन में क्या हो रहा है।",
    "header.title": "हर डिलीवरी को आगे बढ़ाएँ।",
    "common.goodMorning": "सुप्रभात",
    "common.goodAfternoon": "शुभ दोपहर",
    "common.goodEvening": "शुभ संध्या",
  },
  bdo: {
    "nav.dashboard": "ডেশ্বোর্ড",
    "nav.consignments": "আন কনছাইনমেন্ট",
    "nav.vehicles": "আন গাড়ি",
    "nav.tracking": "লাইভ ট্রেকিং আৰু জিপিএছ",
    "nav.fleet-tracking": "গাড়ি ট্রেকিং",
    "nav.routes": "ৰুট পরিকল্পনা",
    "nav.route-optimization": "ৰুট অপ্টিমাইজেছন",
    "nav.alerts": "সতর্ক",
    "nav.history": "ডেলিভাৰী ইতিহাস",
    "nav.reports": "ৰিপ'ৰ্ট আৰু বিশ্লেষণ",
    "nav.settings": "ছেটিংছ",
    "nav.help": "সহায় আৰু সাপোৰ্ট",
    "header.notifications": "জাননি",
    "header.markAllRead": "সব পঢ়া চিন দি",
    "header.noAlerts": "জ’নো সক্ৰিয় সতর্ক নাই — সব ঠিক আছে।",
    "header.settingsProfile": "ছেটিংছ আৰু প্ৰফাইল",
    "header.supportHelp": "সহায় আৰু সাপোৰ্ট",
    "header.signOut": "লগ-আউট",
    "header.addConsignment": "কনছাইনমেন্ট দি",
    "header.operator": "পৰিবহণ অপাৰেটৰ",
    "header.subtitle": "আজি আনি অফিচত কি হৈছে।",
    "header.title": "হায়েক ডেলিভাৰী এগৰিয়াই নিয়।",
    "common.goodMorning": "গুদাম বেলি",
    "common.goodAfternoon": "গুদাম দুপৰ",
    "common.goodEvening": "গুদাম বেলাগ",
  },
};

export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "as", label: "Assamese (অসমীয়া)" },
  { code: "bn", label: "Bengali (বাংলা)" },
  { code: "hi", label: "Hindi (हिन्दी)" },
  { code: "bdo", label: "Bodo (बड़ो)" },
];

const LanguageContext = createContext(undefined);

export const LanguageProvider = ({ children }) => {
  const [lang, setLangState] = useState(() => {
    try {
      return localStorage.getItem("raahi_lang") || "en";
    } catch {
      return "en";
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("raahi_lang", lang);
    } catch { /* storage unavailable */ }
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = (code) => {
    const c = DICT[code] ? code : "en";
    setLangState(c);
  };

  const t = (key) => {
    const table = DICT[lang] || DICT.en;
    return table[key] ?? DICT.en[key] ?? key;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, LANGUAGES }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLang = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLang must be used inside LanguageProvider");
  return ctx;
};

export default LanguageProvider;