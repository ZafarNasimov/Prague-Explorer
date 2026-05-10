// Centralized cache data — single source of truth for frontend.
// Keep in sync with contracts/script/caches.json.

export interface QuizQuestion {
  questionCs: string;
  questionEn: string;
  optionsCs: string[];
  optionsEn: string[];
  answer: number; // index into options (same for both languages)
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
        questionCs: "Která legendární česká kněžna prý sídlila na Vyšehradě a předpověděla slávu Prahy?",
        questionEn: "Which legendary Czech princess reportedly lived at Vyšehrad and prophesied Prague's glory?",
        optionsCs: ["Libuše", "Doubravka", "Mlada"],
        optionsEn: ["Libuše", "Doubravka", "Mlada"],
        answer: 0,
      },
      {
        questionCs: "Kde na Vyšehradě leží pohřbeni slavní Češi jako Dvořák, Mucha nebo Neruda?",
        questionEn: "Where at Vyšehrad are famous Czechs such as Dvořák, Mucha, and Neruda buried?",
        optionsCs: ["Slavín", "Rotunda sv. Martina", "Katedrála sv. Petra a Pavla"],
        optionsEn: ["Slavín", "Rotunda of St. Martin", "Cathedral of Sts. Peter and Paul"],
        answer: 0,
      },
      {
        questionCs: "Ze kterého století pochází Rotunda sv. Martina, nejstarší dochovaná stavba Vyšehradu?",
        questionEn: "From which century does the Rotunda of St. Martin date, the oldest surviving structure at Vyšehrad?",
        optionsCs: ["11. století", "14. století", "17. století"],
        optionsEn: ["11th century", "14th century", "17th century"],
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
        questionCs: "Jaké datum je spojeno se začátkem sametové revoluce v Praze?",
        questionEn: "What date marks the beginning of the Velvet Revolution in Prague?",
        optionsCs: ["17. listopadu 1989", "21. srpna 1968", "25. února 1948"],
        optionsEn: ["17 November 1989", "21 August 1968", "25 February 1948"],
        answer: 0,
      },
      {
        questionCs: "Ve kterém divadle sídlilo Občanské fórum Václava Havla v listopadu 1989?",
        questionEn: "In which theatre was Václav Havel's Civic Forum headquartered in November 1989?",
        optionsCs: ["Laterna Magika", "Národní divadlo", "Divadlo Na Zábradlí"],
        optionsEn: ["Laterna Magika", "National Theatre", "Theatre on the Balustrade"],
        answer: 0,
      },
      {
        questionCs: "Co symbolizují ruce na pamětní desce na Národní třídě č. 16?",
        questionEn: "What do the hands on the memorial plaque at Národní třída 16 represent?",
        optionsCs: ["Prsty svírané v pěst — symbol odporu", "Mír a přátelství mezi národy", "Oběti druhé světové války"],
        optionsEn: ["Fingers pressed into fists — a symbol of resistance", "Peace and friendship between nations", "Victims of World War II"],
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
        questionCs: "Ve kterém roce byl sestaven Staroměstský orloj?",
        questionEn: "In which year was the Old Town Astronomical Clock installed?",
        optionsCs: ["1410", "1248", "1621"],
        optionsEn: ["1410", "1248", "1621"],
        answer: 0,
      },
      {
        questionCs: "Co se zobrazuje na Orloji každou celou hodinu?",
        questionEn: "What happens on the Astronomical Clock every full hour?",
        optionsCs: ["Průvod dvanácti apoštolů", "Korunování českého krále", "Pochod rytířů"],
        optionsEn: ["A procession of the twelve apostles", "A coronation of the Czech king", "A march of knights"],
        answer: 0,
      },
      {
        questionCs: "Kdo byl Jan Hus, jemuž je věnován pomník uprostřed náměstí?",
        questionEn: "Who was Jan Hus, commemorated by the monument in the centre of the square?",
        optionsCs: ["Český náboženský reformátor upálený v roce 1415", "Vítěz bitvy na Bílé hoře", "Zakladatel Karlovy univerzity"],
        optionsEn: ["A Czech religious reformer burned at the stake in 1415", "The victor of the Battle of White Mountain", "The founder of Charles University"],
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
        questionCs: "Kdo je autorem soch miminek lezoucích po Žižkovské věži?",
        questionEn: "Who is the artist behind the giant baby sculptures on the Žižkov TV Tower?",
        optionsCs: ["David Černý", "Josef Václav Myslbek", "Olbram Zoubek"],
        optionsEn: ["David Černý", "Josef Václav Myslbek", "Olbram Zoubek"],
        answer: 0,
      },
      {
        questionCs: "V jakém roce byla Žižkovská věž otevřena pro veřejnost?",
        questionEn: "In which year did the Žižkov TV Tower open to the public?",
        optionsCs: ["1992", "1975", "2001"],
        optionsEn: ["1992", "1975", "2001"],
        answer: 0,
      },
      {
        questionCs: "K čemu původně sloužila věž kromě televizního vysílání za komunistického režimu?",
        questionEn: "What was the tower's secondary use under the communist regime, besides television broadcasting?",
        optionsCs: ["K rušení signálu Rádia Svobodná Evropa", "Jako meteorologická stanice", "Jako vojenský radar"],
        optionsEn: ["Jamming Radio Free Europe signals", "As a meteorological station", "As a military radar"],
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
        questionCs: "Jaký obří monument stál na Letenské pláni do roku 1962?",
        questionEn: "What giant monument stood on Letná Plain until 1962?",
        optionsCs: ["Stalinův pomník", "Pomník Jana Žižky", "Pomník T. G. Masaryka"],
        optionsEn: ["Stalin's monument", "Monument to Jan Žižka", "Monument to T. G. Masaryk"],
        answer: 0,
      },
      {
        questionCs: "Ve kterém roce byl Stalinův pomník v Praze slavnostně odhalen?",
        questionEn: "In which year was the Stalin monument in Prague ceremonially unveiled?",
        optionsCs: ["1955", "1948", "1960"],
        optionsEn: ["1955", "1948", "1960"],
        answer: 0,
      },
      {
        questionCs: "Co stojí na místě pomníku od roku 1991?",
        questionEn: "What has stood in place of the monument since 1991?",
        optionsCs: ["Metronom od Vratislava Nováka", "Fontána se světelnou show", "Socha svobody"],
        optionsEn: ["A metronome by Vratislav Novák", "A fountain with a light show", "A Statue of Liberty"],
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
        questionCs: "Kdy vznikla Lennonova zeď jako spontánní protest pražské mládeže?",
        questionEn: "When did the Lennon Wall emerge as a spontaneous protest by Prague's youth?",
        optionsCs: ["Po Lennonově vraždě v roce 1980", "Během sametové revoluce 1989", "Při Lennonově návštěvě Prahy v roce 1966"],
        optionsEn: ["After Lennon's murder in 1980", "During the Velvet Revolution in 1989", "During Lennon's visit to Prague in 1966"],
        answer: 0,
      },
      {
        questionCs: "Který pražský rodák napsal Proměnu a Proces, přestože psal německy?",
        questionEn: "Which Prague-born writer wrote The Metamorphosis and The Trial, despite writing in German?",
        optionsCs: ["Franz Kafka", "Rainer Maria Rilke", "Max Brod"],
        optionsEn: ["Franz Kafka", "Rainer Maria Rilke", "Max Brod"],
        answer: 0,
      },
      {
        questionCs: "Co zobrazují pohyblivé sochy miminek u Muzea Kampa?",
        questionEn: "What do the moving baby sculptures at Museum Kampa depict?",
        optionsCs: ["Tytéž postavy jako na Žižkovské věži, od Davida Černého", "Děti hrající si u řeky", "Oběti povodní z roku 2002"],
        optionsEn: ["The same figures as on the Žižkov Tower, by David Černý", "Children playing by the river", "Victims of the 2002 floods"],
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
