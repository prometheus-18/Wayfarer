/**
 * Curated offline travel phrasebook + mini city guides.
 *
 * Pure data, no SDK imports. These documents are embedded on-device (see the
 * RAG pipeline in `src/qvac/`) so the assistant can retrieve a relevant phrase
 * or local tip with zero connectivity. Each document is deliberately
 * self-contained — category tag, English phrase and all four translations in
 * one string — so a single retrieved chunk is useful on its own.
 *
 * Content rules: high-value traveler phrases only, natural translations with
 * proper accents (á/ñ/ç/ß/è …), and evergreen, factual city-guide notes (no
 * prices or schedules that go stale).
 */

export interface PhrasebookDocument {
  /** Stable id, e.g. "phrase-emergency-01" or "guide-paris-03". */
  id: string;
  /** Self-contained text used both for embedding and for display. */
  text: string;
}

/** Bump when the corpus changes so cached embeddings can be invalidated. */
export const PHRASEBOOK_VERSION = 1;

/** Builds the canonical one-line phrase document. */
function phrase(
  id: string,
  category: string,
  en: string,
  es: string,
  fr: string,
  de: string,
  it: string,
): PhrasebookDocument {
  return {
    id,
    text: `Phrase [${category}]: "${en}" — Spanish: "${es}" — French: "${fr}" — German: "${de}" — Italian: "${it}"`,
  };
}

/** Builds a short, self-contained city-guide document. */
function guide(id: string, city: string, topic: string, text: string): PhrasebookDocument {
  return { id, text: `${city} city guide [${topic}]: ${text}` };
}

// ---------------------------------------------------------------------------
// Emergencies (medical, police, embassy, lost documents)
// ---------------------------------------------------------------------------

const EMERGENCY_PHRASES: PhrasebookDocument[] = [
  phrase(
    'phrase-emergency-01',
    'emergencies',
    'Help!',
    '¡Socorro!',
    'Au secours !',
    'Hilfe!',
    'Aiuto!',
  ),
  phrase(
    'phrase-emergency-02',
    'emergencies',
    'Call an ambulance, please.',
    'Llame a una ambulancia, por favor.',
    "Appelez une ambulance, s'il vous plaît.",
    'Rufen Sie bitte einen Krankenwagen.',
    "Chiami un'ambulanza, per favore.",
  ),
  phrase(
    'phrase-emergency-03',
    'emergencies',
    'I need a doctor.',
    'Necesito un médico.',
    "J'ai besoin d'un médecin.",
    'Ich brauche einen Arzt.',
    'Ho bisogno di un medico.',
  ),
  phrase(
    'phrase-emergency-04',
    'emergencies',
    'Where is the nearest hospital?',
    '¿Dónde está el hospital más cercano?',
    "Où est l'hôpital le plus proche ?",
    'Wo ist das nächste Krankenhaus?',
    "Dov'è l'ospedale più vicino?",
  ),
  phrase(
    'phrase-emergency-05',
    'emergencies',
    'Call the police!',
    '¡Llame a la policía!',
    'Appelez la police !',
    'Rufen Sie die Polizei!',
    'Chiami la polizia!',
  ),
  phrase(
    'phrase-emergency-06',
    'emergencies',
    'I have been robbed.',
    'Me han robado.',
    "On m'a volé.",
    'Ich bin bestohlen worden.',
    'Sono stato derubato.',
  ),
  phrase(
    'phrase-emergency-07',
    'emergencies',
    'I lost my passport.',
    'He perdido mi pasaporte.',
    "J'ai perdu mon passeport.",
    'Ich habe meinen Pass verloren.',
    'Ho perso il passaporto.',
  ),
  phrase(
    'phrase-emergency-08',
    'emergencies',
    'I need to contact my embassy.',
    'Necesito contactar con mi embajada.',
    'Je dois contacter mon ambassade.',
    'Ich muss meine Botschaft kontaktieren.',
    'Devo contattare la mia ambasciata.',
  ),
  phrase(
    'phrase-emergency-09',
    'emergencies',
    'It is an emergency.',
    'Es una emergencia.',
    "C'est une urgence.",
    'Es ist ein Notfall.',
    "È un'emergenza.",
  ),
  phrase(
    'phrase-emergency-10',
    'emergencies',
    'I am allergic to this medication.',
    'Soy alérgico a este medicamento.',
    'Je suis allergique à ce médicament.',
    'Ich bin allergisch gegen dieses Medikament.',
    'Sono allergico a questo farmaco.',
  ),
  phrase(
    'phrase-emergency-11',
    'emergencies',
    'I feel very sick.',
    'Me siento muy mal.',
    'Je me sens très mal.',
    'Mir ist sehr schlecht.',
    'Mi sento molto male.',
  ),
  phrase(
    'phrase-emergency-12',
    'emergencies',
    'Where is the nearest pharmacy?',
    '¿Dónde está la farmacia más cercana?',
    'Où est la pharmacie la plus proche ?',
    'Wo ist die nächste Apotheke?',
    "Dov'è la farmacia più vicina?",
  ),
];

// ---------------------------------------------------------------------------
// Dietary needs & allergies
// ---------------------------------------------------------------------------

const DIETARY_PHRASES: PhrasebookDocument[] = [
  phrase(
    'phrase-dietary-01',
    'dietary & allergies',
    'I am allergic to peanuts.',
    'Soy alérgico a los cacahuetes.',
    'Je suis allergique aux cacahuètes.',
    'Ich bin allergisch gegen Erdnüsse.',
    'Sono allergico alle arachidi.',
  ),
  phrase(
    'phrase-dietary-02',
    'dietary & allergies',
    'I am allergic to nuts.',
    'Soy alérgico a los frutos secos.',
    'Je suis allergique aux fruits à coque.',
    'Ich bin allergisch gegen Nüsse.',
    'Sono allergico alla frutta a guscio.',
  ),
  phrase(
    'phrase-dietary-03',
    'dietary & allergies',
    'Does this contain gluten?',
    '¿Esto contiene gluten?',
    'Est-ce que cela contient du gluten ?',
    'Enthält das Gluten?',
    'Questo contiene glutine?',
  ),
  phrase(
    'phrase-dietary-04',
    'dietary & allergies',
    'I cannot eat dairy products.',
    'No puedo comer productos lácteos.',
    'Je ne peux pas manger de produits laitiers.',
    'Ich kann keine Milchprodukte essen.',
    'Non posso mangiare latticini.',
  ),
  phrase(
    'phrase-dietary-05',
    'dietary & allergies',
    'I am vegetarian.',
    'Soy vegetariano.',
    'Je suis végétarien.',
    'Ich bin Vegetarier.',
    'Sono vegetariano.',
  ),
  phrase(
    'phrase-dietary-06',
    'dietary & allergies',
    'I am vegan.',
    'Soy vegano.',
    'Je suis végétalien.',
    'Ich bin Veganer.',
    'Sono vegano.',
  ),
  phrase(
    'phrase-dietary-07',
    'dietary & allergies',
    'Is this halal?',
    '¿Esto es halal?',
    "Est-ce que c'est halal ?",
    'Ist das halal?',
    'Questo è halal?',
  ),
  phrase(
    'phrase-dietary-08',
    'dietary & allergies',
    'Does this dish contain shellfish?',
    '¿Este plato lleva marisco?',
    'Ce plat contient-il des fruits de mer ?',
    'Enthält dieses Gericht Meeresfrüchte?',
    'Questo piatto contiene frutti di mare?',
  ),
  phrase(
    'phrase-dietary-09',
    'dietary & allergies',
    'I have a severe food allergy.',
    'Tengo una alergia alimentaria grave.',
    "J'ai une allergie alimentaire grave.",
    'Ich habe eine schwere Lebensmittelallergie.',
    'Ho una grave allergia alimentare.',
  ),
  phrase(
    'phrase-dietary-10',
    'dietary & allergies',
    'Can you make it without eggs?',
    '¿Puede prepararlo sin huevo?',
    "Pouvez-vous le préparer sans œufs ?",
    'Können Sie es ohne Eier zubereiten?',
    'Può prepararlo senza uova?',
  ),
];

// ---------------------------------------------------------------------------
// Transport (train, bus, taxi, airport)
// ---------------------------------------------------------------------------

const TRANSPORT_PHRASES: PhrasebookDocument[] = [
  phrase(
    'phrase-transport-01',
    'transport',
    'Where is the train station?',
    '¿Dónde está la estación de tren?',
    'Où est la gare ?',
    'Wo ist der Bahnhof?',
    "Dov'è la stazione ferroviaria?",
  ),
  phrase(
    'phrase-transport-02',
    'transport',
    'One ticket to the city center, please.',
    'Un billete al centro de la ciudad, por favor.',
    "Un billet pour le centre-ville, s'il vous plaît.",
    'Eine Fahrkarte ins Stadtzentrum, bitte.',
    'Un biglietto per il centro città, per favore.',
  ),
  phrase(
    'phrase-transport-03',
    'transport',
    'Which platform does the train leave from?',
    '¿De qué andén sale el tren?',
    'De quel quai part le train ?',
    'Von welchem Gleis fährt der Zug ab?',
    'Da quale binario parte il treno?',
  ),
  phrase(
    'phrase-transport-04',
    'transport',
    'When does the next bus leave?',
    '¿Cuándo sale el próximo autobús?',
    'Quand part le prochain bus ?',
    'Wann fährt der nächste Bus ab?',
    'Quando parte il prossimo autobus?',
  ),
  phrase(
    'phrase-transport-05',
    'transport',
    'Does this bus go to the airport?',
    '¿Este autobús va al aeropuerto?',
    "Est-ce que ce bus va à l'aéroport ?",
    'Fährt dieser Bus zum Flughafen?',
    "Questo autobus va all'aeroporto?",
  ),
  phrase(
    'phrase-transport-06',
    'transport',
    'Please take me to this address.',
    'Lléveme a esta dirección, por favor.',
    "Emmenez-moi à cette adresse, s'il vous plaît.",
    'Bringen Sie mich bitte zu dieser Adresse.',
    'Mi porti a questo indirizzo, per favore.',
  ),
  phrase(
    'phrase-transport-07',
    'transport',
    'How much is the fare?',
    '¿Cuánto cuesta el trayecto?',
    'Combien coûte la course ?',
    'Was kostet die Fahrt?',
    'Quanto costa la corsa?',
  ),
  phrase(
    'phrase-transport-08',
    'transport',
    'Where can I buy a ticket?',
    '¿Dónde puedo comprar un billete?',
    'Où puis-je acheter un billet ?',
    'Wo kann ich eine Fahrkarte kaufen?',
    'Dove posso comprare un biglietto?',
  ),
  phrase(
    'phrase-transport-09',
    'transport',
    'Is this seat taken?',
    '¿Está ocupado este asiento?',
    'Cette place est-elle prise ?',
    'Ist dieser Platz besetzt?',
    'È occupato questo posto?',
  ),
  phrase(
    'phrase-transport-10',
    'transport',
    'I missed my flight.',
    'He perdido mi vuelo.',
    "J'ai raté mon vol.",
    'Ich habe meinen Flug verpasst.',
    'Ho perso il volo.',
  ),
  phrase(
    'phrase-transport-11',
    'transport',
    'Where is the taxi stand?',
    '¿Dónde está la parada de taxis?',
    'Où est la station de taxis ?',
    'Wo ist der Taxistand?',
    "Dov'è la fermata dei taxi?",
  ),
  phrase(
    'phrase-transport-12',
    'transport',
    'Please stop here.',
    'Pare aquí, por favor.',
    "Arrêtez-vous ici, s'il vous plaît.",
    'Halten Sie bitte hier an.',
    'Si fermi qui, per favore.',
  ),
];

// ---------------------------------------------------------------------------
// Accommodation
// ---------------------------------------------------------------------------

const ACCOMMODATION_PHRASES: PhrasebookDocument[] = [
  phrase(
    'phrase-accommodation-01',
    'accommodation',
    'I have a reservation.',
    'Tengo una reserva.',
    "J'ai une réservation.",
    'Ich habe eine Reservierung.',
    'Ho una prenotazione.',
  ),
  phrase(
    'phrase-accommodation-02',
    'accommodation',
    'Do you have a room available for tonight?',
    '¿Tiene una habitación libre para esta noche?',
    'Avez-vous une chambre libre pour ce soir ?',
    'Haben Sie ein Zimmer für heute Nacht frei?',
    'Avete una camera libera per stanotte?',
  ),
  phrase(
    'phrase-accommodation-03',
    'accommodation',
    'What time is check-out?',
    '¿A qué hora hay que dejar la habitación?',
    'À quelle heure faut-il libérer la chambre ?',
    'Um wie viel Uhr ist der Check-out?',
    'A che ora è il check-out?',
  ),
  phrase(
    'phrase-accommodation-04',
    'accommodation',
    'Is breakfast included?',
    '¿Está incluido el desayuno?',
    'Le petit-déjeuner est-il inclus ?',
    'Ist das Frühstück inbegriffen?',
    'La colazione è inclusa?',
  ),
  phrase(
    'phrase-accommodation-05',
    'accommodation',
    'The air conditioning does not work.',
    'El aire acondicionado no funciona.',
    'La climatisation ne fonctionne pas.',
    'Die Klimaanlage funktioniert nicht.',
    "L'aria condizionata non funziona.",
  ),
  phrase(
    'phrase-accommodation-06',
    'accommodation',
    'Can I leave my luggage here?',
    '¿Puedo dejar mi equipaje aquí?',
    'Puis-je laisser mes bagages ici ?',
    'Kann ich mein Gepäck hier lassen?',
    'Posso lasciare qui i miei bagagli?',
  ),
  phrase(
    'phrase-accommodation-07',
    'accommodation',
    'What is the Wi-Fi password?',
    '¿Cuál es la contraseña del wifi?',
    'Quel est le mot de passe du Wi-Fi ?',
    'Wie lautet das WLAN-Passwort?',
    'Qual è la password del Wi-Fi?',
  ),
  phrase(
    'phrase-accommodation-08',
    'accommodation',
    'I would like to stay one more night.',
    'Me gustaría quedarme una noche más.',
    'Je voudrais rester une nuit de plus.',
    'Ich möchte eine Nacht länger bleiben.',
    "Vorrei restare un'altra notte.",
  ),
];

// ---------------------------------------------------------------------------
// Food & restaurant
// ---------------------------------------------------------------------------

const FOOD_PHRASES: PhrasebookDocument[] = [
  phrase(
    'phrase-food-01',
    'food & restaurant',
    'A table for two, please.',
    'Una mesa para dos, por favor.',
    "Une table pour deux, s'il vous plaît.",
    'Einen Tisch für zwei, bitte.',
    'Un tavolo per due, per favore.',
  ),
  phrase(
    'phrase-food-02',
    'food & restaurant',
    'The menu, please.',
    'La carta, por favor.',
    "La carte, s'il vous plaît.",
    'Die Speisekarte, bitte.',
    'Il menù, per favore.',
  ),
  phrase(
    'phrase-food-03',
    'food & restaurant',
    'What do you recommend?',
    '¿Qué me recomienda?',
    'Que me recommandez-vous ?',
    'Was empfehlen Sie?',
    'Cosa mi consiglia?',
  ),
  phrase(
    'phrase-food-04',
    'food & restaurant',
    'I would like to order this.',
    'Quisiera pedir esto.',
    'Je voudrais commander ceci.',
    'Ich möchte das bestellen.',
    'Vorrei ordinare questo.',
  ),
  phrase(
    'phrase-food-05',
    'food & restaurant',
    'Still water, please.',
    'Agua sin gas, por favor.',
    "De l'eau plate, s'il vous plaît.",
    'Stilles Wasser, bitte.',
    'Acqua naturale, per favore.',
  ),
  phrase(
    'phrase-food-06',
    'food & restaurant',
    'The bill, please.',
    'La cuenta, por favor.',
    "L'addition, s'il vous plaît.",
    'Die Rechnung, bitte.',
    'Il conto, per favore.',
  ),
  phrase(
    'phrase-food-07',
    'food & restaurant',
    'It was delicious.',
    'Estaba delicioso.',
    "C'était délicieux.",
    'Es war köstlich.',
    'Era squisito.',
  ),
  phrase(
    'phrase-food-08',
    'food & restaurant',
    'Can we pay separately?',
    '¿Podemos pagar por separado?',
    'Pouvons-nous payer séparément ?',
    'Können wir getrennt zahlen?',
    'Possiamo pagare separatamente?',
  ),
  phrase(
    'phrase-food-09',
    'food & restaurant',
    'Do you accept credit cards?',
    '¿Aceptan tarjetas de crédito?',
    'Acceptez-vous les cartes de crédit ?',
    'Akzeptieren Sie Kreditkarten?',
    'Accettate carte di credito?',
  ),
  phrase(
    'phrase-food-10',
    'food & restaurant',
    'Not too spicy, please.',
    'No muy picante, por favor.',
    "Pas trop épicé, s'il vous plaît.",
    'Bitte nicht zu scharf.',
    'Non troppo piccante, per favore.',
  ),
  phrase(
    'phrase-food-11',
    'food & restaurant',
    'A coffee, please.',
    'Un café, por favor.',
    "Un café, s'il vous plaît.",
    'Einen Kaffee, bitte.',
    'Un caffè, per favore.',
  ),
  phrase(
    'phrase-food-12',
    'food & restaurant',
    'Excuse me, this is not what I ordered.',
    'Disculpe, esto no es lo que pedí.',
    "Excusez-moi, ce n'est pas ce que j'ai commandé.",
    'Entschuldigung, das habe ich nicht bestellt.',
    'Mi scusi, non è quello che ho ordinato.',
  ),
];

// ---------------------------------------------------------------------------
// Shopping & bargaining
// ---------------------------------------------------------------------------

const SHOPPING_PHRASES: PhrasebookDocument[] = [
  phrase(
    'phrase-shopping-01',
    'shopping & bargaining',
    'How much does this cost?',
    '¿Cuánto cuesta esto?',
    'Combien ça coûte ?',
    'Wie viel kostet das?',
    'Quanto costa questo?',
  ),
  phrase(
    'phrase-shopping-02',
    'shopping & bargaining',
    'That is too expensive.',
    'Es demasiado caro.',
    "C'est trop cher.",
    'Das ist zu teuer.',
    'È troppo caro.',
  ),
  phrase(
    'phrase-shopping-03',
    'shopping & bargaining',
    'Can you give me a better price?',
    '¿Me puede hacer un mejor precio?',
    'Pouvez-vous me faire un meilleur prix ?',
    'Können Sie mir einen besseren Preis machen?',
    'Può farmi un prezzo migliore?',
  ),
  phrase(
    'phrase-shopping-04',
    'shopping & bargaining',
    'I am just looking, thank you.',
    'Solo estoy mirando, gracias.',
    'Je regarde seulement, merci.',
    'Ich schaue mich nur um, danke.',
    'Sto solo guardando, grazie.',
  ),
  phrase(
    'phrase-shopping-05',
    'shopping & bargaining',
    'I will take it.',
    'Me lo llevo.',
    'Je le prends.',
    'Ich nehme es.',
    'Lo prendo.',
  ),
  phrase(
    'phrase-shopping-06',
    'shopping & bargaining',
    'Do you have this in another size?',
    '¿Tiene esto en otra talla?',
    'Avez-vous ceci dans une autre taille ?',
    'Haben Sie das in einer anderen Größe?',
    "Avete questo in un'altra taglia?",
  ),
  phrase(
    'phrase-shopping-07',
    'shopping & bargaining',
    'Can I get a receipt, please?',
    '¿Me da un recibo, por favor?',
    "Puis-je avoir un reçu, s'il vous plaît ?",
    'Kann ich bitte eine Quittung bekommen?',
    'Posso avere lo scontrino, per favore?',
  ),
  phrase(
    'phrase-shopping-08',
    'shopping & bargaining',
    'Can I pay in cash?',
    '¿Puedo pagar en efectivo?',
    'Puis-je payer en espèces ?',
    'Kann ich bar bezahlen?',
    'Posso pagare in contanti?',
  ),
];

// ---------------------------------------------------------------------------
// Directions
// ---------------------------------------------------------------------------

const DIRECTIONS_PHRASES: PhrasebookDocument[] = [
  phrase(
    'phrase-directions-01',
    'directions',
    'Where is the bathroom?',
    '¿Dónde está el baño?',
    'Où sont les toilettes ?',
    'Wo ist die Toilette?',
    "Dov'è il bagno?",
  ),
  phrase(
    'phrase-directions-02',
    'directions',
    'How do I get to the city center?',
    '¿Cómo llego al centro de la ciudad?',
    'Comment puis-je aller au centre-ville ?',
    'Wie komme ich ins Stadtzentrum?',
    'Come arrivo in centro città?',
  ),
  phrase(
    'phrase-directions-03',
    'directions',
    'Is it far from here?',
    '¿Está lejos de aquí?',
    "Est-ce loin d'ici ?",
    'Ist es weit von hier?',
    'È lontano da qui?',
  ),
  phrase(
    'phrase-directions-04',
    'directions',
    'Can you show me on the map?',
    '¿Puede mostrármelo en el mapa?',
    'Pouvez-vous me montrer sur la carte ?',
    'Können Sie es mir auf der Karte zeigen?',
    'Può mostrarmelo sulla mappa?',
  ),
  phrase(
    'phrase-directions-05',
    'directions',
    'Is it to the left or to the right?',
    '¿Está a la izquierda o a la derecha?',
    'Est-ce à gauche ou à droite ?',
    'Ist es links oder rechts?',
    'È a sinistra o a destra?',
  ),
  phrase(
    'phrase-directions-06',
    'directions',
    'I am lost.',
    'Estoy perdido.',
    'Je suis perdu.',
    'Ich habe mich verlaufen.',
    'Mi sono perso.',
  ),
  phrase(
    'phrase-directions-07',
    'directions',
    'Where is the nearest metro station?',
    '¿Dónde está la estación de metro más cercana?',
    'Où est la station de métro la plus proche ?',
    'Wo ist die nächste U-Bahn-Station?',
    "Dov'è la stazione della metropolitana più vicina?",
  ),
  phrase(
    'phrase-directions-08',
    'directions',
    'Can you write down the address for me?',
    '¿Puede escribirme la dirección?',
    "Pouvez-vous m'écrire l'adresse ?",
    'Können Sie mir die Adresse aufschreiben?',
    "Può scrivermi l'indirizzo?",
  ),
];

// ---------------------------------------------------------------------------
// Social & courtesy
// ---------------------------------------------------------------------------

const SOCIAL_PHRASES: PhrasebookDocument[] = [
  phrase(
    'phrase-social-01',
    'social & courtesy',
    'Good morning.',
    'Buenos días.',
    'Bonjour.',
    'Guten Morgen.',
    'Buongiorno.',
  ),
  phrase(
    'phrase-social-02',
    'social & courtesy',
    'Good evening.',
    'Buenas noches.',
    'Bonsoir.',
    'Guten Abend.',
    'Buonasera.',
  ),
  phrase(
    'phrase-social-03',
    'social & courtesy',
    'Please.',
    'Por favor.',
    "S'il vous plaît.",
    'Bitte.',
    'Per favore.',
  ),
  phrase(
    'phrase-social-04',
    'social & courtesy',
    'Thank you very much.',
    'Muchas gracias.',
    'Merci beaucoup.',
    'Vielen Dank.',
    'Grazie mille.',
  ),
  phrase(
    'phrase-social-05',
    'social & courtesy',
    'Excuse me.',
    'Disculpe.',
    'Excusez-moi.',
    'Entschuldigung.',
    'Mi scusi.',
  ),
  phrase(
    'phrase-social-06',
    'social & courtesy',
    'I am sorry.',
    'Lo siento.',
    'Je suis désolé.',
    'Es tut mir leid.',
    'Mi dispiace.',
  ),
  phrase(
    'phrase-social-07',
    'social & courtesy',
    'Do you speak English?',
    '¿Habla inglés?',
    'Parlez-vous anglais ?',
    'Sprechen Sie Englisch?',
    'Parla inglese?',
  ),
  phrase(
    'phrase-social-08',
    'social & courtesy',
    'I do not understand.',
    'No entiendo.',
    'Je ne comprends pas.',
    'Ich verstehe nicht.',
    'Non capisco.',
  ),
  phrase(
    'phrase-social-09',
    'social & courtesy',
    'Could you speak more slowly, please?',
    '¿Puede hablar más despacio, por favor?',
    "Pouvez-vous parler plus lentement, s'il vous plaît ?",
    'Können Sie bitte langsamer sprechen?',
    'Può parlare più lentamente, per favore?',
  ),
  phrase(
    'phrase-social-10',
    'social & courtesy',
    'Goodbye, have a nice day!',
    '¡Adiós, que tenga un buen día!',
    'Au revoir, bonne journée !',
    'Auf Wiedersehen, schönen Tag noch!',
    'Arrivederci, buona giornata!',
  ),
];

// ---------------------------------------------------------------------------
// Mini city guide: Barcelona
// ---------------------------------------------------------------------------

const BARCELONA_GUIDE: PhrasebookDocument[] = [
  guide(
    'guide-barcelona-01',
    'Barcelona',
    'getting from the airport',
    'From Barcelona–El Prat Airport, the Aerobús shuttle runs frequently from both ' +
      'terminals to Plaça de Catalunya in roughly 35 minutes. Metro line L9 Sud also ' +
      'serves both terminals but requires a special airport ticket — standard ' +
      'multi-ride passes are not valid at the airport stations. The R2 Nord commuter ' +
      'train from Terminal 2 reaches Barcelona Sants and Passeig de Gràcia; a free ' +
      'green shuttle bus connects Terminal 1 to the train station.',
  ),
  guide(
    'guide-barcelona-02',
    'Barcelona',
    'metro basics',
    'The TMB metro is the fastest way around Barcelona, and almost all tourist sights ' +
      'sit inside Zone 1. A multi-ride card (such as the T-casual) is far cheaper per ' +
      'trip than single tickets and works on metro, bus and tram. Validate your ticket ' +
      'at the turnstile, and note the metro runs late on Friday nights and all night ' +
      'on Saturdays.',
  ),
  guide(
    'guide-barcelona-03',
    'Barcelona',
    'tipping custom',
    'Tipping in Barcelona is appreciated but never obligatory — service is included ' +
      'in restaurant prices. Locals typically round up the bill or leave small change, ' +
      'and around 5% is already generous for good table service. There is no need to ' +
      'tip in bars or taxis beyond rounding up.',
  ),
  guide(
    'guide-barcelona-04',
    'Barcelona',
    'common scams to avoid',
    'Pickpocketing is the main risk in Barcelona, especially on La Rambla, in crowded ' +
      'metro cars and around major sights. Watch for classic distractions: petition ' +
      'signers, the "bird droppings on your jacket" trick, and street shell games. ' +
      'Keep bags zipped and worn in front, and never leave a phone on a café table.',
  ),
  guide(
    'guide-barcelona-05',
    'Barcelona',
    'emergency numbers',
    'The EU-wide emergency number 112 works for police, fire and ambulance anywhere ' +
      'in Spain. You can also dial 091 for the national police, 092 for the local ' +
      'Guàrdia Urbana, and 061 for medical emergencies in Catalonia. Pharmacies are ' +
      'marked with a green cross and post the nearest on-duty (farmàcia de guàrdia) ' +
      'location after hours.',
  ),
  guide(
    'guide-barcelona-06',
    'Barcelona',
    'food tip',
    'Lunch is the main meal in Barcelona and many restaurants offer a fixed-price ' +
      'weekday "menú del dia" — several courses for far less than dinner prices. ' +
      'Locals eat late: lunch around 2pm and dinner rarely before 9pm. Try pa amb ' +
      'tomàquet (bread rubbed with tomato and olive oil), the Catalan staple served ' +
      'with almost everything.',
  ),
];

// ---------------------------------------------------------------------------
// Mini city guide: Paris
// ---------------------------------------------------------------------------

const PARIS_GUIDE: PhrasebookDocument[] = [
  guide(
    'guide-paris-01',
    'Paris',
    'getting from the airport',
    'From Charles de Gaulle Airport, the RER B train reaches Gare du Nord and ' +
      'Châtelet–Les Halles in central Paris in about 35 minutes; the Roissybus runs ' +
      'to Opéra. Official taxis charge a flat rate into the city — ignore anyone ' +
      'offering rides inside the terminal. From Orly Airport, metro line 14 runs ' +
      'directly into central Paris, and the Orlybus serves Place Denfert-Rochereau.',
  ),
  guide(
    'guide-paris-02',
    'Paris',
    'metro basics',
    'The Paris métro is dense — you are rarely more than a few minutes from a ' +
      'station, and lines are numbered with the end-of-line station naming the ' +
      'direction. Buy a rechargeable Navigo Easy card instead of single paper ' +
      'tickets, and keep your ticket or card handy until you exit, as inspections ' +
      'are common. Trains run from around 5:30am to about 1:15am, later on Friday ' +
      'and Saturday nights.',
  ),
  guide(
    'guide-paris-03',
    'Paris',
    'tipping custom',
    'In France a 15% service charge is included in restaurant prices by law, shown ' +
      'as "service compris" on the bill. Tipping on top is optional: Parisians ' +
      'round up or leave a euro or two for good service. No tip is expected in ' +
      'taxis or cafés beyond rounding up.',
  ),
  guide(
    'guide-paris-04',
    'Paris',
    'common scams to avoid',
    'Around major Paris attractions, watch for the gold ring "found" at your feet, ' +
      'clipboard petition crews, and the friendship-bracelet trick on the steps of ' +
      'Sacré-Cœur — all are setups for distraction theft or aggressive demands for ' +
      'money. Pickpockets favour crowded metro line 1 and the areas around the ' +
      'Eiffel Tower and the Louvre. Politely say "non, merci" and keep walking.',
  ),
  guide(
    'guide-paris-05',
    'Paris',
    'emergency numbers',
    'The EU-wide emergency number 112 works throughout France. You can also dial 15 ' +
      'for medical emergencies (SAMU), 17 for police, and 18 for the fire brigade, ' +
      'which also responds to medical calls. Pharmacies display a green cross and ' +
      'can advise on minor ailments.',
  ),
  guide(
    'guide-paris-06',
    'Paris',
    'food tip',
    'For the best-value meal in Paris, look for the lunchtime "formule" or prix-fixe ' +
      'menu — two or three courses at a fraction of the evening price. Kitchens keep ' +
      'strict hours: lunch roughly 12–2pm and dinner from 7:30pm, with many closed in ' +
      'between. At a bakery, ask for a "baguette tradition" — it must by law be made ' +
      'on site with no additives, and it beats the standard baguette.',
  ),
];

/**
 * The full embedded corpus: 80 phrase documents + 12 city-guide documents.
 * Order is stable so document indices can be cached alongside
 * `PHRASEBOOK_VERSION`.
 */
export const PHRASEBOOK_DOCUMENTS: PhrasebookDocument[] = [
  ...EMERGENCY_PHRASES,
  ...DIETARY_PHRASES,
  ...TRANSPORT_PHRASES,
  ...ACCOMMODATION_PHRASES,
  ...FOOD_PHRASES,
  ...SHOPPING_PHRASES,
  ...DIRECTIONS_PHRASES,
  ...SOCIAL_PHRASES,
  ...BARCELONA_GUIDE,
  ...PARIS_GUIDE,
];
