// Centralized cache data — single source of truth for frontend.
// Keep in sync with contracts/script/caches.json.

export interface QuizQuestion {
  question: string;
  options: string[];
  answer: number; // index into options
}

export interface Cache {
  id: number;
  nameCz: string;
  nameEn: string;
  descriptionCz: string;
  descriptionEn: string;
  lat: number;
  lon: number;
  quiz: QuizQuestion[];
  // Demo address representing the institution. Generated 2026-05-08, private key discarded.
  beneficiary: string;
  institutionCz: string;
  institutionEn: string;
}

export const CACHES: Cache[] = [
  {
    id: 1,
    nameCz: "Vyšehrad",
    nameEn: "Vyšehrad Fortress",
    descriptionCz: "Historická pevnost tyčící se nad Vltavou, místo legendy o kněžně Libuši.",
    descriptionEn: "Historic fortress above the Vltava river, birthplace of the Libuše legend.",
    lat: 50.065,
    lon: 14.4189,
    beneficiary: "0x7B98698fc5F430b9f4b51691ed78Fe5a805902aB",
    institutionCz: "Správa Vyšehrad",
    institutionEn: "Vyšehrad Administration",
    quiz: [
      {
        question: "Která legendární česká kněžna prý sídlila na Vyšehradě a předpověděla slávu Prahy?",
        options: ["Libuše", "Doubravka", "Mlada"],
        answer: 0,
      },
      {
        question: "Kde na Vyšehradě leží pohřbeni slavní Češi jako Dvořák, Mucha nebo Neruda?",
        options: ["Slavín", "Rotunda sv. Martina", "Katedrála sv. Petra a Pavla"],
        answer: 0,
      },
      {
        question: "Ze kterého století pochází Rotunda sv. Martina, nejstarší dochovaná stavba Vyšehradu?",
        options: ["11. století", "14. století", "17. století"],
        answer: 0,
      },
    ],
  },
  {
    id: 2,
    nameCz: "Národní třída",
    nameEn: "Národní Street — Velvet Revolution",
    descriptionCz: "Bulvár, kde 17. listopadu 1989 policie zaútočila na pokojnou demonstraci studentů.",
    descriptionEn: "The boulevard where on 17 November 1989 police attacked a peaceful student march.",
    lat: 50.0806,
    lon: 14.4169,
    beneficiary: "0x8890e8f0D89bec707C99e80Ed4F0e463eb5B8E80",
    institutionCz: "Ústav pro studium totalitních režimů",
    institutionEn: "Institute for the Study of Totalitarian Regimes",
    quiz: [
      {
        question: "Jaké datum je spojeno se začátkem sametové revoluce v Praze?",
        options: ["17. listopadu 1989", "21. srpna 1968", "25. února 1948"],
        answer: 0,
      },
      {
        question: "Ve kterém divadle sídlilo Občanské fórum Václava Havla v listopadu 1989?",
        options: ["Laterna Magika", "Národní divadlo", "Divadlo Na Zábradlí"],
        answer: 0,
      },
      {
        question: "Co symbolizují ruce na pamětní desce na Národní třídě č. 16?",
        options: ["Prsty svírané v pěst — symbol odporu", "Mír a přátelství mezi národy", "Oběti druhé světové války"],
        answer: 0,
      },
    ],
  },
  {
    id: 3,
    nameCz: "Staroměstské náměstí",
    nameEn: "Old Town Square",
    descriptionCz: "Srdce starého města s astronomickým orlojem a gotickým Týnským chrámem.",
    descriptionEn: "The heart of Old Town with the astronomical clock and Gothic Týn Church.",
    lat: 50.0875,
    lon: 14.4214,
    beneficiary: "0xc8B427BE431bcD3a104070A629523a3b7EA8772c",
    institutionCz: "Muzeum hlavního města Prahy",
    institutionEn: "City of Prague Museum",
    quiz: [
      {
        question: "Ve kterém roce byl sestaven Staroměstský orloj?",
        options: ["1410", "1248", "1621"],
        answer: 0,
      },
      {
        question: "Co se zobrazuje na Orloji každou celou hodinu?",
        options: ["Průvod dvanácti apoštolů", "Korunování českého krále", "Pochod rytířů"],
        answer: 0,
      },
      {
        question: "Kdo byl Jan Hus, jemuž je věnován pomník uprostřed náměstí?",
        options: ["Český náboženský reformátor upálený v roce 1415", "Vítěz bitvy na Bílé hoře", "Zakladatel Karlovy univerzity"],
        answer: 0,
      },
    ],
  },
  {
    id: 4,
    nameCz: "Žižkovský televizní vysílač",
    nameEn: "Žižkov TV Tower",
    descriptionCz: "Dominanta pražského horizontu s gigantickými sochami miminek od Davida Černého.",
    descriptionEn: "Prague's skyline icon, famous for the giant baby sculptures by David Černý.",
    lat: 50.0793,
    lon: 14.4511,
    beneficiary: "0x5906F65B373Ca0E172C704a05c9736838D7257C0",
    institutionCz: "DOX — Centrum současného umění",
    institutionEn: "DOX Centre for Contemporary Art",
    quiz: [
      {
        question: "Kdo je autorem soch miminek lezoucích po Žižkovské věži?",
        options: ["David Černý", "Josef Václav Myslbek", "Olbram Zoubek"],
        answer: 0,
      },
      {
        question: "V jakém roce byla Žižkovská věž otevřena pro veřejnost?",
        options: ["1992", "1975", "2001"],
        answer: 0,
      },
      {
        question: "K čemu původně sloužila věž kromě televizního vysílání za komunistického režimu?",
        options: ["K rušení signálu Rádia Svobodná Evropa", "Jako meteorologická stanice", "Jako vojenský radar"],
        answer: 0,
      },
    ],
  },
  {
    id: 5,
    nameCz: "Letenská pláň — Metronom",
    nameEn: "Letná Plain — Metronome",
    descriptionCz: "Místo největšího Stalinova pomníku na světě. Dnes ho nahrazuje obří metronom.",
    descriptionEn: "Site of the world's largest Stalin monument, now replaced by a giant metronome.",
    lat: 50.0977,
    lon: 14.4162,
    beneficiary: "0xd9cbb64461b29751f38Befbc20223181D6e70762",
    institutionCz: "Nadace pro dokumentaci paměti národa",
    institutionEn: "Memory of Nations Foundation",
    quiz: [
      {
        question: "Jaký obří monument stál na Letenské pláni do roku 1962?",
        options: ["Stalinův pomník", "Pomník Jana Žižky", "Pomník T. G. Masaryka"],
        answer: 0,
      },
      {
        question: "Ve kterém roce byl Stalinův pomník v Praze slavnostně odhalen?",
        options: ["1955", "1948", "1960"],
        answer: 0,
      },
      {
        question: "Co stojí na místě pomníku od roku 1991?",
        options: ["Metronom od Vratislava Nováka", "Fontána se světelnou show", "Socha svobody"],
        answer: 0,
      },
    ],
  },
  {
    id: 6,
    nameCz: "Kampa — Lennonova zeď",
    nameEn: "Kampa — Lennon Wall",
    descriptionCz: "Ostrov Kampa s proslulou Lennonovou zdí, symbolem odporu proti komunismu.",
    descriptionEn: "Kampa island with the famous Lennon Wall — a symbol of resistance.",
    lat: 50.0862,
    lon: 14.409,
    beneficiary: "0x665eF14222739A667A16198B6b62dc204f1771E4",
    institutionCz: "Museum Kampa",
    institutionEn: "Museum Kampa",
    quiz: [
      {
        question: "Kdy vznikla Lennonova zeď jako spontánní protest pražské mládeže?",
        options: ["Po Lennonově vraždě v roce 1980", "Během sametové revoluce 1989", "Při Lennonově návštěvě Prahy v roce 1966"],
        answer: 0,
      },
      {
        question: "Který pražský rodák napsal Proměnu a Proces, přestože psal německy?",
        options: ["Franz Kafka", "Rainer Maria Rilke", "Max Brod"],
        answer: 0,
      },
      {
        question: "Co zobrazují pohyblivé sochy miminek u Muzea Kampa?",
        options: ["Tytéž postavy jako na Žižkovské věži, od Davida Černého", "Děti hrající si u řeky", "Oběti povodní z roku 2002"],
        answer: 0,
      },
    ],
  },
];

export function getCacheById(id: number): Cache | undefined {
  return CACHES.find((c) => c.id === id);
}

export function getCacheName(cache: Cache, locale: string): string {
  return locale === "cs" ? cache.nameCz : cache.nameEn;
}
