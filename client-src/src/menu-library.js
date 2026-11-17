import { asset } from "./base.js";
// Bibliothèque d'images de plats. Dans chaque catégorie : de la photo la plus appétissante à la moins appétissante.
// Photos d'illustration : le plat réellement servi peut légèrement différer.
// vitrine: true  -> affichée uniquement sur la page client (pas proposée aux restaurants).
const p = (file, nom, description, vitrine = false) => ({ src: asset(`/menu-library/${file}.jpg`), nom, description, vitrine });

export const MENU_LIBRARY = [
  { id: "burgers", titre: "Burgers et wraps", items: [
    p("58-burgers-frites", "Trio de burgers bacon et œuf", "Pain brioché au sésame, steak, bacon croustillant, œuf et frites dorées.", true),
    p("52-burger-bacon-bleu", "Burger bacon et fromage bleu", "Pain brioché, steak grillé, bacon croustillant et fromage bleu fondant."),
    p("20-burger", "Burger double steak", "Pain brioché, double steak, fromage fondu, cornichons, salade et sauce maison.", true),
    p("21-wrap-poulet", "Wrap de poulet grillé", "Galette grillée, poulet mariné, tomate, salade et sauce blanche.", true),
    p("23-wrap-boeuf", "Wrap de bœuf grillé", "Viande grillée généreuse, crudités et sauce crémeuse dans une galette chaude.", true),
    p("22-shawarma", "Shawarma", "Pain plat roulé, viande grillée, tomate et sauce, à déguster bien chaud.", true),
    p("44-cheeseburger", "Cheeseburger-frites", "Steak grillé, fromage fondant, pain toasté et frites dorées.", true),
    p("45-burger-poulet", "Burger escalope de poulet", "Poulet croustillant, fromage et garniture fraîche dans un pain moelleux.", true),
    p("46-shawarma-poulet", "Shawarma au poulet", "Poulet mariné, sauce à l’ail, crudités et frites, roulés dans un pain chaud.", true),
  ] },
  { id: "brochettes", titre: "Brochettes", items: [
    p("06-brochettes-ananas", "Brochettes à l'ananas grillé", "Viande caramélisée, poivrons et ananas grillé : sucré, salé, fumé."),
    p("07-brochettes-boeuf", "Brochettes de viande aux poivrons", "Cubes de viande tendres, courgettes et poivrons colorés, parfumés aux herbes."),
    p("09-brochettes-porc", "Brochettes de viande aux légumes", "Morceaux grillés avec courgette, poivron et oignon, juteux à souhait."),
    p("11-brochettes-poulet-citron", "Brochettes aux herbes et au citron", "Brochettes grillées aux herbes fraîches, servies avec une pointe de citron."),
    p("08-brochettes-quinoa", "Brochettes sur lit de céréales", "Viande épicée, oignons et poivrons, servis sur des céréales parfumées."),
    p("10-brochettes-poisson", "Brochettes marinées aux épices", "Morceaux marinés aux épices et au piment doux, grillés en brochettes."),
    p("04-brochettes-grill", "Brochettes grillées au feu", "Viande marinée, oignons et poivrons, grillées sur la braise."),
    p("05-brochettes-assiette", "Brochettes mixtes", "Viande et saucisse en brochettes avec poivrons rouges et oignons, bien dorées."),
    p("47-brochettes-poulet", "Brochettes de poulet", "Poulet mariné et grillé à la braise, servi avec des frites.", true),
    p("48-brochettes-poisson", "Brochettes de poisson", "Poisson assaisonné et grillé en brochettes, avec légumes et citron.", true),
  ] },
  { id: "braises", titre: "Poissons et poulets braisés", items: [
    p("62-poulet-braise-frites-duo", "Poulet braisé, frites et crudités", "Poulet braisé à point, frites dorées, carottes, oignons et tomate, avec ses sauces.", true),
    p("63-poulet-grille-assiette-noire", "Poulet grillé aux herbes", "Morceaux de poulet grillés, frites croustillantes et crudités fraîches.", true),
    p("66-poulet-grille-frites-salade-mais", "Poulet grillé, frites et salade de maïs", "Poulet grillé, frites dorées et salade fraîche au maïs, à la tomate et à l'oignon.", true),
    p("64-poulet-grille-frites", "Poulet grillé et frites", "Poulet grillé bien doré, frites et salade croquante.", true),
    p("60-poulet-grille-salade", "Poulet grillé et salade composée", "Poulet mariné grillé et grande salade colorée au maïs, tomate et oignon.", true),
    p("67-poulet-frites-salade", "Poulet grillé, frites et crudités", "Poulet grillé juteux, frites et crudités.", true),
    p("56-poisson-braise-frites", "Poisson braisé, frites et crudités", "Poisson grillé aux herbes, frites dorées, crudités et oignons fondants."),
    p("35-poisson-jollof", "Poisson braisé et riz jollof", "Poisson entier grillé aux herbes, servi avec du riz jollof, petits pois et carottes, et sa sauce pimentée.", true),
    p("41-poisson-sauce-herbes", "Poisson braisé à la sauce aux herbes", "Poisson grillé nappé d'une sauce parfumée aux herbes, avec sa petite sauce pimentée.", true),
    p("03-poisson-alloco", "Poisson frit, alloco et sauce tomate", "Poisson croustillant, alloco, attiéké et sauce tomate relevée, avec sa salade fraîche."),
    p("01-poisson-attieke", "Poisson braisé et attiéké", "Poisson grillé aux herbes, attiéké moelleux, oignons fondants, alloco doré et sauce pimentée."),
    p("42-poissons-plaque", "Poissons braisés au four", "Poissons grillés aux herbes, oignons, tomates et citron vert.", true),
    p("02-poulet-alloco", "Poulet braisé, alloco et attiéké", "Cuisse de poulet grillée, alloco croustillant, attiéké et salade fraîche de tomates et poivrons."),
  ] },
  { id: "grillades", titre: "Viandes grillées", items: [
    p("59-travers-alloco", "Travers grillés et alloco", "Travers caramélisés au feu de bois, alloco doré et salade fraîche.", true),
    p("65-steak-frites", "Steak grillé et frites", "Steak grillé mariné, frites dorées et crudités.", true),
    p("61-assortiment-grillades", "Assortiment de grillades", "Brochettes, poulet, côtes de porc et burger : un plateau pour se régaler.", true),
    p("34-cotes-alloco", "Côtes grillées et alloco", "Viande grillée aux herbes, servie avec de l'alloco doré et caramélisé.", true),
    p("33-viande-grillee", "Viande grillée au feu de bois", "Morceaux de viande grillés lentement sur la braise, parfumés aux herbes.", true),
    p("49-cotis-braises", "Côtis braisés", "Côtes braisées à la sauce barbecue, avec des pommes de terre rôties.", true),
  ] },
  { id: "salades", titre: "Salades gourmandes", items: [
    p("54-salade-composee", "Grande salade composée", "Laitue, tomate, concombre, avocat, maïs, pommes de terre et œufs durs, avec sa vinaigrette."),
    p("27-sansfeuilles-2", "Le « sans feuilles » à l'avocat", "Spaghettis, œuf dur, avocat, tomate, petits pois, frites dorées et sauce crémeuse.", true),
    p("29-salade-brocoli", "Salade de brocoli à l'œuf", "Brocoli croquant, œuf, oignon rouge et graines, dans une sauce légère.", true),
    p("26-sansfeuilles-1", "Le « sans feuilles » généreux", "Une assiette copieuse : œuf dur, tomate, avocat, frites et sauce crémeuse.", true),
    p("28-sansfeuilles-3", "Le « sans feuilles » en montagne", "Œuf dur, tomate, frites et sauce crémeuse, servis bien hauts.", true),
  ] },
  { id: "spaghettis", titre: "Spaghettis", items: [
    p("24-spaghetti-boeuf", "Spaghettis à la viande et aux poivrons", "Spaghettis sautés, morceaux de viande tendres, poivrons, tomate et oignon.", true),
    p("25-spaghetti-marmite", "Spaghettis à la viande", "Spaghettis mijotés en sauce tomate avec de généreux morceaux de viande.", true),
  ] },
  { id: "poulet", titre: "Ailes de poulet", items: [
    p("13-ailes-grillees", "Ailes de poulet croustillantes", "Ailes bien croustillantes, relevées d'herbes fraîches et d'un quartier de citron vert."),
    p("12-ailes-epicees", "Ailes de poulet épicées", "Ailes dorées au four, assaisonnées d'épices parfumées."),
    p("50-ailes-poulet", "Ailes de poulet street food", "Ailes de poulet croustillantes, assaisonnées et relevées.", true),
  ] },
  { id: "riz", titre: "Riz et plats mijotés", items: [
    p("53-riz-poulet-plateau", "Plateau de riz au poulet grillé", "Riz parfumé aux petits légumes, poulet grillé, œufs durs, olives et poivrons."),
    p("55-riz-rouge-poulet-roti", "Riz rouge au poulet rôti", "Riz rouge mijoté, poulet rôti doré, carottes, olives, œufs et citron."),
    p("57-poulet-petits-pois", "Poulet rôti aux petits pois", "Poulet rôti, petits pois et pommes de terre fondantes, servis avec du pain."),
    p("37-riz-poulet-legumes", "Riz au poulet grillé et aux légumes", "Poulet grillé, carottes, chou, gombo et piment sur un lit de riz parfumé.", true),
    p("36-thieb-viande-legumes", "Riz à la viande et aux légumes mijotés", "Riz parfumé, viande fondante, chou, carottes et légumes mijotés.", true),
    p("43-riz-viande-assiette", "Riz parfumé et viande mijotée aux oignons", "Riz parfumé accompagné de viande fondante, d'oignons et de poivrons.", true),
    p("16-riz-poisson", "Riz parfumé au poisson et aux légumes", "Riz parfumé, poisson, carottes, gombo et piment, mijotés ensemble."),
    p("18-riz-viande", "Riz à la viande et aux légumes", "Riz fondant, viande tendre, chou, carotte et légumes du marché."),
    p("17-riz-jollof", "Riz jollof", "Riz mijoté dans une sauce tomate épicée, parfumé à la feuille de laurier."),
  ] },
  { id: "accompagnements", titre: "Accompagnements", items: [
    p("40-alloco-bol", "Alloco en bol", "Bananes plantain frites, dorées et caramélisées.", true),
    p("38-alloco-assiette", "Alloco croustillant", "Alloco doré et croustillant, à partager.", true),
    p("19-alloco", "Alloco", "Bananes plantain frites, caramélisées et fondantes."),
    p("15-frites-assiette", "Frites croustillantes", "Une assiette de frites bien dorées, croustillantes dehors, moelleuses dedans."),
    p("31-manioc-bol", "Manioc en morceaux", "Morceaux de manioc fondants, à déguster avec une sauce ou un plat en sauce."),
    p("14-frites-paprika", "Frites au paprika", "Frites dorées, saupoudrées de paprika."),
    p("32-manioc-tranches", "Manioc en tranches", "Tranches de manioc tendres, parfaites pour accompagner poisson ou viande."),
    p("39-alloco-gros-plan", "Alloco bien doré", "Morceaux de plantain frits, fondants et caramélisés.", true),
    p("30-manioc-baton", "Bâton de manioc", "Manioc roulé dans sa feuille de bananier, un accompagnement traditionnel."),
    p("51-frites", "Frites dorées", "Frites bien dorées, croustillantes dehors et moelleuses dedans.", true),
  ] },
];

// Ce que les restaurants peuvent choisir (hors photos réservées à la vitrine).
export const RESTAURANT_LIBRARY = MENU_LIBRARY
  .map((group) => ({ ...group, items: group.items.filter((item) => !item.vitrine) }))
  .filter((group) => group.items.length > 0);

// Pour la page client : photos d'illustration (le plat servi peut différer).
export const ILLUSTRATION_NOTE = "Photos d'illustration : le plat servi peut légèrement différer.";
