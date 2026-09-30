"""Download the real (public) sources of the dataset and write generator/catalog_real.json.

Sources: Justel (Belgian law), EU Publications Office / CELLAR (EU law + CJEU),
HUDOC (ECHR), CNT/NAR (national CCTs), foreign statute sites, Belgian government
guidance pages and HR-provider articles.

Usage: python3 generator/fetch_real.py [--only ID ...]
"""
import html
import json
import re
import sys
import time
from datetime import date
from html.parser import HTMLParser
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
CATALOG = Path(__file__).resolve().parent / "catalog_real.json"
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36"}
TODAY = date.today().isoformat()

# --------------------------------------------------------------------------- sources
# theme codes: T1 dismissal/serious cause, T2 working time/overtime/disconnect,
# T3 telework/cross-border, T4 leave/sickness, T5 harassment/wellbeing/discrimination,
# T6 monitoring/privacy.

JUSTEL = [
    # id, eli path, lang, articles (None = whole text), themes, title, doc date
    ("LAW-BE-1978-ART35-FR", "loi/1978/07/03/1978070303", "fr", ["35"], ["T1"],
     "Loi du 3 juillet 1978 relative aux contrats de travail – art. 35 (motif grave)", "1978-07-03"),
    ("LAW-BE-1978-ART35-NL", "wet/1978/07/03/1978070303", "nl", ["35"], ["T1"],
     "Wet van 3 juli 1978 betreffende de arbeidsovereenkomsten – art. 35 (dringende reden)", "1978-07-03"),
    ("LAW-BE-1978-ART37-39-FR", "loi/1978/07/03/1978070303", "fr", ["37", "37/2", "39"], ["T1"],
     "Loi du 3 juillet 1978 – art. 37, 37/2, 39 (préavis et indemnité de rupture)", "1978-07-03"),
    ("LAW-BE-1978-ART31-FR", "loi/1978/07/03/1978070303", "fr", ["31", "31/1"], ["T4"],
     "Loi du 3 juillet 1978 – art. 31 (incapacité de travail, certificat médical)", "1978-07-03"),
    ("LAW-BE-1978-ART16-20-FR", "loi/1978/07/03/1978070303", "fr", ["16", "17", "20"], ["T1", "T6"],
     "Loi du 3 juillet 1978 – art. 16, 17, 20 (obligations des parties)", "1978-07-03"),
    ("LAW-BE-1971-HOURS-FR", "loi/1971/03/16/1971031602", "fr", ["19", "20", "20bis", "22"], ["T2"],
     "Loi du 16 mars 1971 sur le travail – art. 19 à 22 (durée du travail)", "1971-03-16"),
    ("LAW-BE-1971-OVERTIME-FR", "loi/1971/03/16/1971031602", "fr", ["25", "26", "26bis", "29"], ["T2"],
     "Loi du 16 mars 1971 sur le travail – art. 25 à 29 (heures supplémentaires, sursalaire)", "1971-03-16"),
    ("LAW-BE-1971-OVERTIME-NL", "wet/1971/03/16/1971031602", "nl", ["26bis", "29"], ["T2"],
     "Arbeidswet van 16 maart 1971 – art. 26bis en 29 (overuren, overloon)", "1971-03-16"),
    ("RD-BE-1965-TRUST-FR", "arrete/1965/02/10/1965021001", "fr", None, ["T2"],
     "Arrêté royal du 10 février 1965 désignant les personnes investies d'un poste de direction ou de confiance", "1965-02-10"),
    ("LAW-BE-1996-HARASS-DEF-FR", "loi/1996/08/04/1996012650", "fr", ["32bis", "32ter"], ["T5"],
     "Loi du 4 août 1996 relative au bien-être – art. 32bis, 32ter (définitions harcèlement)", "1996-08-04"),
    ("LAW-BE-1996-HARASS-DEF-NL", "wet/1996/08/04/1996012650", "nl", ["32bis", "32ter"], ["T5"],
     "Welzijnswet van 4 augustus 1996 – art. 32bis, 32ter (definities pesterijen)", "1996-08-04"),
    ("LAW-BE-1996-PROCEDURE-FR", "loi/1996/08/04/1996012650", "fr", ["32quater", "32quinquies", "32sexies", "32septies"], ["T5"],
     "Loi du 4 août 1996 – art. 32quater à 32septies (mesures et procédure)", "1996-08-04"),
    ("LAW-BE-1996-RETALIATION-FR", "loi/1996/08/04/1996012650", "fr", ["32terdecies", "32terdecies/1"], ["T5", "T1"],
     "Loi du 4 août 1996 – art. 32tredecies (Justel : 32terdecies) – protection contre les représailles", "1996-08-04"),
    ("LAW-BE-1968-ART51-FR", "loi/1968/12/05/1968120503", "fr", ["51"], ["T1", "T2", "T3", "T4", "T5", "T6"],
     "Loi du 5 décembre 1968 sur les CCT – art. 51 (hiérarchie des sources)", "1968-12-05"),
    ("LAW-BE-2007-DISCRIM-FR", "loi/2007/05/10/2007002099", "fr", ["3", "4", "5", "14"], ["T5"],
     "Loi du 10 mai 2007 tendant à lutter contre certaines formes de discrimination – art. 3 à 5, 14", "2007-05-10"),
    ("LAW-BE-2005-SECRECY-FR", "loi/2005/06/13/2005011238", "fr", ["124", "125"], ["T6"],
     "Loi du 13 juin 2005 relative aux communications électroniques – art. 124, 125 (secret des communications)", "2005-06-13"),
    ("LAW-BE-1971-HOLIDAYS-FR", "loi/1971/06/28/1971062850", "fr", ["2", "3", "4", "5"], ["T4"],
     "Lois coordonnées du 28 juin 1971 relatives aux vacances annuelles – art. 2 à 5", "1971-06-28"),
    ("RD-BE-1997-PARENTAL-FR", "arrete/1997/10/29/1997012760", "fr", None, ["T4"],
     "Arrêté royal du 29 octobre 1997 relatif au congé parental", "1997-10-29"),
]

EU_LAW = [
    # id, celex, articles, themes, title, date
    ("EU-DIR-2003-88-WTD", "32003L0088", ["2", "3", "5", "6", "7", "16", "17"], ["T2", "T4"],
     "Directive 2003/88/EC – organisation of working time", "2003-11-04"),
    ("EU-DIR-2019-1158-WLB", "32019L1158", ["3", "5", "10", "11", "12"], ["T4", "T5"],
     "Directive (EU) 2019/1158 – work-life balance for parents and carers", "2019-06-20"),
    ("EU-REG-2016-679-GDPR", "32016R0679", ["5", "6", "13", "15", "88"], ["T6"],
     "Regulation (EU) 2016/679 – General Data Protection Regulation (extract)", "2016-04-27"),
    ("EU-REG-2004-883-SOCSEC", "32004R0883", ["11", "12", "13"], ["T3"],
     "Regulation (EC) No 883/2004 – coordination of social security systems (applicable legislation)", "2004-04-29"),
    ("EU-REG-2008-593-ROME1", "32008R0593", ["3", "8"], ["T3"],
     "Regulation (EC) No 593/2008 – law applicable to contractual obligations (Rome I)", "2008-06-17"),
    ("EU-DIR-2000-78-EQUAL", "32000L0078", ["1", "2", "9", "11"], ["T5"],
     "Directive 2000/78/EC – equal treatment in employment and occupation", "2000-11-27"),
    ("EU-DIR-2006-54-GENDER", "32006L0054", ["2", "14", "15", "24"], ["T5", "T4"],
     "Directive 2006/54/EC – equal treatment of men and women (recast)", "2006-07-05"),
    ("EU-CHARTER-2012", "12012P/TXT", ["7", "8", "30", "31", "33"], ["T1", "T2", "T4", "T6"],
     "Charter of Fundamental Rights of the European Union (extract)", "2012-10-26"),
]

CJEU = [
    # id, celex, themes, title, date
    ("CJEU-C-55-18-CCOO", "62018CJ0055", ["T2"], "CJEU C-55/18 CCOO v Deutsche Bank (time recording)", "2019-05-14"),
    ("CJEU-C-518-15-MATZAK", "62015CJ0518", ["T2"], "CJEU C-518/15 Ville de Nivelles v Matzak (stand-by time)", "2018-02-21"),
    ("CJEU-C-580-19-OFFENBACH", "62019CJ0580", ["T2"], "CJEU C-580/19 RJ v Stadt Offenbach am Main (stand-by time)", "2021-03-09"),
    ("CJEU-C-684-16-MAXPLANCK", "62016CJ0684", ["T4"], "CJEU C-684/16 Max-Planck-Gesellschaft v Shimizu (annual leave)", "2018-11-06"),
    ("CJEU-C-116-08-MEERTS", "62008CJ0116", ["T4", "T1"], "CJEU C-116/08 Meerts v Proost (parental leave & dismissal indemnity)", "2009-10-22"),
    ("CJEU-C-7-12-RIEZNIECE", "62012CJ0007", ["T4", "T5"], "CJEU C-7/12 Riežniece (assessment of worker returning from parental leave)", "2013-06-20"),
    ("CJEU-C-610-18-AFMB", "62018CJ0610", ["T3"], "CJEU C-610/18 AFMB (identification of employer, Reg. 883/2004)", "2020-07-16"),
    ("CJEU-C-17-19-BOUYGUES", "62019CJ0017", ["T3"], "CJEU C-17/19 Bouygues travaux publics (A1 certificates)", "2020-05-14"),
]

HUDOC = [
    ("ECHR-61496-08-BARBULESCU", "001-177082", ["T6"], "ECtHR (GC) Bărbulescu v. Romania, no. 61496/08", "2017-09-05"),
    ("ECHR-1874-13-LOPEZ-RIBALDA", "001-197098", ["T6"], "ECtHR (GC) López Ribalda and Others v. Spain, nos. 1874/13 and 8567/13", "2019-10-17"),
]

CNT = [
    ("CCT-BE-109", "109", ["T1"], "CCT n° 109 – motivation du licenciement", "2014-02-12"),
    ("CCT-BE-081", "081", ["T6"], "CCT n° 81 – contrôle des données de communication électroniques en réseau", "2002-04-26"),
    ("CCT-BE-085", "085", ["T3"], "CCT n° 85 – télétravail", "2005-11-09"),
    ("CCT-BE-149", "149", ["T3"], "CCT n° 149 – télétravail recommandé ou obligatoire", "2021-01-26"),
    ("CCT-BE-064", "064", ["T4"], "CCT n° 64 – congé parental", "1997-04-29"),
    ("CCT-BE-045", "045", ["T4"], "CCT n° 45 – congé pour raisons impérieuses", "1989-03-19"),
    ("CCT-BE-100", "100", ["T5"], "CCT n° 100 – politique préventive en matière d'alcool et de drogues", "2009-04-01"),
    ("CCT-BE-025", "025", ["T5"], "CCT n° 25 – égalité des rémunérations hommes/femmes", "1975-10-15"),
    ("CCT-BE-038", "038", ["T5"], "CCT n° 38 – recrutement et sélection (non-discrimination)", "1983-12-06"),
]

# (id, url, folder, jurisdiction, lang, themes, title, issuer, date, weight_hint, article_filter)
WEB = [
    # foreign legislation
    ("LAW-DE-BGB-626", "https://www.gesetze-im-internet.de/bgb/__626.html", "01_legislation/foreign/de", "DE", "de", ["T1"],
     "BGB § 626 – Fristlose Kündigung aus wichtigem Grund", "Bundesministerium der Justiz", "2002-01-02", None),
    ("LAW-DE-ARBZG", "https://www.gesetze-im-internet.de/arbzg/BJNR117100994.html", "01_legislation/foreign/de", "DE", "de", ["T2"],
     "Arbeitszeitgesetz (ArbZG) – §§ 1-7", "Bundesministerium der Justiz", "1994-06-06", ("§ 1", "§ 8")),
    ("LAW-DE-BEEG-18", "https://www.gesetze-im-internet.de/beeg/__18.html", "01_legislation/foreign/de", "DE", "de", ["T4"],
     "BEEG § 18 – Kündigungsschutz während der Elternzeit", "Bundesministerium der Justiz", "2006-12-05", None),
    ("LAW-NL-BW7-678", "https://wetten.overheid.nl/BWBR0005290/2024-01-01/0/Boek7/Titeldeel10/Afdeling9/Artikel678",
     "01_legislation/foreign/nl", "NL", "nl", ["T1"],
     "Burgerlijk Wetboek Boek 7 – art. 7:677-7:678 (dringende reden)", "Overheid.nl", "2024-01-01", ["Artikel677", "Artikel678"]),
    ("LAW-NL-ATW", "https://wetten.overheid.nl/BWBR0007671/", "01_legislation/foreign/nl", "NL", "nl", ["T2"],
     "Arbeidstijdenwet – hoofdstuk 5 (arbeids- en rusttijden)", "Overheid.nl", "1995-12-23", ["Artikel5:3", "Artikel5:7", "Artikel5:8"]),
    ("LAW-NL-WFW", "https://wetten.overheid.nl/BWBR0011173/", "01_legislation/foreign/nl", "NL", "nl", ["T3"],
     "Wet flexibel werken – art. 2 (verzoek aanpassing arbeidsplaats)", "Overheid.nl", "2000-02-19", ["Artikel2"]),
    ("LAW-FR-L1222-9", "https://code.travail.gouv.fr/code-du-travail/l1222-9", "01_legislation/foreign/fr", "FR", "fr", ["T3"],
     "Code du travail (FR) – art. L1222-9 (télétravail)", "Ministère du Travail (FR)", "2018-03-29", None),
    ("LAW-FR-L1234-1", "https://code.travail.gouv.fr/code-du-travail/l1234-1", "01_legislation/foreign/fr", "FR", "fr", ["T1"],
     "Code du travail (FR) – art. L1234-1 (préavis, faute grave)", "Ministère du Travail (FR)", "2008-05-01", None),
    ("LAW-FR-L1152-1", "https://code.travail.gouv.fr/code-du-travail/l1152-1", "01_legislation/foreign/fr", "FR", "fr", ["T5"],
     "Code du travail (FR) – art. L1152-1 (harcèlement moral)", "Ministère du Travail (FR)", "2012-08-08", None),
    ("LAW-UK-ERA-98", "https://www.legislation.gov.uk/ukpga/1996/18/section/98", "01_legislation/foreign/uk", "UK", "en", ["T1"],
     "Employment Rights Act 1996 – s. 98 (fairness of dismissal)", "legislation.gov.uk", "1996-05-22", None),
    ("LAW-UK-WTR-4", "https://www.legislation.gov.uk/uksi/1998/1833/regulation/4", "01_legislation/foreign/uk", "UK", "en", ["T2"],
     "Working Time Regulations 1998 – reg. 4 (maximum weekly working time)", "legislation.gov.uk", "1998-10-01", None),
    ("LAW-UK-EQA-26", "https://www.legislation.gov.uk/ukpga/2010/15/section/26", "01_legislation/foreign/uk", "UK", "en", ["T5"],
     "Equality Act 2010 – s. 26 (harassment)", "legislation.gov.uk", "2010-04-08", None),
    # official guidance
    ("GUI-BE-EMPLOI-LICENCIEMENT", "https://emploi.belgique.be/fr/themes/contrats-de-travail/fin-du-contrat-de-travail/fin-du-contrat-duree-indeterminee-licenciement",
     "04_official_guidance", "BE", "fr", ["T1"], "SPF Emploi – Fin du contrat à durée indéterminée : licenciement", "SPF Emploi, Travail et Concertation sociale", None, None),
    ("GUI-BE-EMPLOI-REGLEMENT", "https://emploi.belgique.be/fr/themes/reglementation-du-travail/reglement-de-travail",
     "04_official_guidance", "BE", "fr", ["T1", "T4", "T6"], "SPF Emploi – Règlement de travail", "SPF Emploi, Travail et Concertation sociale", None, None),
    ("GUI-BE-EMPLOI-DUREE", "https://emploi.belgique.be/fr/themes/reglementation-du-travail/duree-du-travail-et-temps-de-repos/duree-du-travail-dans-le",
     "04_official_guidance", "BE", "fr", ["T2"], "SPF Emploi – Durée du travail (secteur privé)", "SPF Emploi, Travail et Concertation sociale", None, None),
    ("GUI-BE-EMPLOI-REPOS", "https://emploi.belgique.be/fr/themes/reglementation-du-travail/duree-du-travail-et-temps-de-repos/intervalles-de-repos",
     "04_official_guidance", "BE", "fr", ["T2"], "SPF Emploi – Intervalles de repos", "SPF Emploi, Travail et Concertation sociale", None, None),
    ("GUI-BE-EMPLOI-TELETRAVAIL", "https://emploi.belgique.be/fr/themes/contrats-de-travail/teletravail/teletravail-occasionnel",
     "04_official_guidance", "BE", "fr", ["T3"], "SPF Emploi – Télétravail occasionnel", "SPF Emploi, Travail et Concertation sociale", None, None),
    ("GUI-BE-ONSS-TELEWORK", "https://www.socialsecurity.be/employer/instructions/dmfa/fr/latest/instructions/special_cases/telework.html",
     "04_official_guidance", "BE", "fr", ["T3"], "ONSS – Instructions DmfA : télétravail (cas particuliers)", "ONSS / RSZ", None, None),
    ("GUI-BE-EMPLOI-CONGE-PARENTAL", "https://emploi.belgique.be/fr/themes/jours-feries-et-conges/conge-parental",
     "04_official_guidance", "BE", "fr", ["T4"], "SPF Emploi – Congé parental", "SPF Emploi, Travail et Concertation sociale", None, None),
    ("GUI-BE-EMPLOI-SUSPENSION", "https://emploi.belgique.be/fr/themes/contrats-de-travail/suspension-du-contrat-de-travail",
     "04_official_guidance", "BE", "fr", ["T4"], "SPF Emploi – Suspension du contrat de travail (incapacité)", "SPF Emploi, Travail et Concertation sociale", None, None),
    ("GUI-BE-EMPLOI-RPS-ACTION", "https://emploi.belgique.be/fr/themes/bien-etre-au-travail/risques-psychosociaux-au-travail/moyens-daction-du-travailleur-la",
     "04_official_guidance", "BE", "fr", ["T5"], "SPF Emploi – Risques psychosociaux : moyens d'action du travailleur", "SPF Emploi, Travail et Concertation sociale", None, None),
    ("GUI-BE-EMPLOI-RPS-REPRESAILLES", "https://emploi.belgique.be/fr/themes/bien-etre-au-travail/risques-psychosociaux-au-travail/protection-contre-les-represailles",
     "04_official_guidance", "BE", "fr", ["T5", "T1"], "SPF Emploi – Protection contre les représailles", "SPF Emploi, Travail et Concertation sociale", None, None),
    ("GUI-BE-APD-TRAVAIL", "https://www.autoriteprotectiondonnees.be/citoyen/themes/vie-privee-sur-le-lieu-du-travail",
     "04_official_guidance", "BE", "fr", ["T6"], "APD – Vie privée sur le lieu de travail", "Autorité de protection des données", None, None),
    ("GUI-BE-APD-SURVEILLANCE", "https://www.autoriteprotectiondonnees.be/citoyen/themes/vie-privee-sur-le-lieu-du-travail/surveillance-de-l-employeur-",
     "04_official_guidance", "BE", "fr", ["T6"], "APD – Vie privée au travail : la surveillance de l'employeur", "Autorité de protection des données", None, None),
    # external secondary
    ("EXT-LIANTIS-DECONNECTIE", "https://www.liantis.be/nl/nieuws/arbeidsdeal-deconnectie-voor-ondernemingen-met-minstens-20-werknemers",
     "13_external_secondary", "BE", "nl", ["T2"], "Liantis – Arbeidsdeal: deconnectie voor ondernemingen met minstens 20 werknemers", "Liantis", None, None),
    ("EXT-ACERTA-OVERUREN", "https://www.acerta.be/nl/werkgevers/verlonen-en-belonen/loonadministratie/wetgeving-overuren",
     "13_external_secondary", "BE", "nl", ["T2"], "Acerta – Wetgeving overuren", "Acerta", None, None),
    ("EXT-SDWORX-TELEWERK-BUITENLAND", "https://www.sdworx.be/nl-be/nieuws-inspiratie/strategisch-duurzaam-hr/telewerk-vanuit-het-buitenland-de-belangrijkste-regels",
     "13_external_secondary", "BE", "nl", ["T3"], "SD Worx – Telewerk vanuit het buitenland: de belangrijkste regels", "SD Worx", None, None),
    ("EXT-ACERTA-GRENSARBEID", "https://www.acerta.be/nl/werkgevers/aanwerven/vaste-tewerkstelling/buitenlandse-werknemer-en-grensarbeid",
     "13_external_secondary", "BE", "nl", ["T3"], "Acerta – Buitenlandse werknemer en grensarbeid", "Acerta", None, None),
    ("EXT-SDWORX-TELEWERK-BUITENLAND-2021", "https://www.sdworx.be/nl-be/over-sd-worx/pers/2021-06-29-telewerken-vanuit-het-buitenland-op-reis-met-je-laptop-check-de-meest",
     "13_external_secondary", "BE", "nl", ["T3"], "SD Worx (2021) – Telewerken vanuit het buitenland: op reis met je laptop?", "SD Worx", "2021-06-29", None),
    ("EXT-ACERTA-OUDERSCHAPSVERLOF", "https://www.acerta.be/nl/werkgevers/vakantie-en-verlofregeling/bijzondere-verlofstelsels/ouderschapsverlof",
     "13_external_secondary", "BE", "nl", ["T4"], "Acerta – Ouderschapsverlof", "Acerta", None, None),
    ("EXT-UCM-CONGE-PARENTAL-ACCUEIL", "https://www.ucm.be/actualites/conge-dadoption-et-conge-parental-daccueil-extension-depuis-le-1er-janvier-2025",
     "13_external_secondary", "BE", "fr", ["T4"], "UCM – Congé d'adoption et congé parental d'accueil : extension depuis 2025", "UCM", None, None),
    ("EXT-ACERTA-DRINGENDE-REDEN", "https://www.acerta.be/nl/inspiratie/een-werknemer-om-dringende-redenen-ontslaan-zonder-opzeg-noch-vergoeding-kan-dat",
     "13_external_secondary", "BE", "nl", ["T1"], "Acerta – Een werknemer om dringende redenen ontslaan zonder opzeg noch vergoeding: kan dat?", "Acerta", None, None),
    ("EXT-LIANTIS-HARCELEMENT", "https://www.liantis.be/fr/nouvelles/conseils-semaine-contre-harcelement",
     "13_external_secondary", "BE", "fr", ["T5"], "Liantis – Conseils : semaine contre le harcèlement", "Liantis", None, None),
    ("EXT-LIANTIS-HARCELEMENT-2022", "https://www.liantis.be/fr/nouvelles/un-collaborateur-sur-7-encore-confronte-au-harcelement-en-2022",
     "13_external_secondary", "BE", "fr", ["T5"], "Liantis – Un collaborateur sur 7 encore confronté au harcèlement", "Liantis", None, None),
    ("EXT-SECUREX-CAMERAS", "https://www.securex.be/fr/lex4you/employeur/actualites/cameras-sur-votre-lieu-de-travail-respectez-les-regles-en-matiere-de-vie-privee",
     "13_external_secondary", "BE", "fr", ["T6"], "Securex – Caméras sur votre lieu de travail : respectez les règles vie privée", "Securex", None, None),
    ("EXT-UCM-CAMERAS", "https://www.ucm.be/actualites/cameras-de-surveillance-marche-suivre",
     "13_external_secondary", "BE", "fr", ["T6"], "UCM – Caméras de surveillance : marche à suivre", "UCM", None, None),
]

FOLDER_WEIGHTS = {"01_legislation": 1.0, "02_case_law": 0.9, "03_collective_agreements": 0.9,
                  "04_official_guidance": 0.8, "13_external_secondary": 0.35}

# --------------------------------------------------------------------------- helpers
S = requests.Session()
S.headers.update(UA)


def get(url, min_len=500, **kw):
    for attempt in range(4):
        try:
            r = S.get(url, timeout=90, **kw)
            if r.status_code == 200 and len(r.content) > min_len:
                return r
            print(f"   status {r.status_code} ({len(r.content)} B), retry {attempt + 1}")
        except requests.RequestException as e:
            print(f"   error {e}, retry {attempt + 1}")
        time.sleep(3 * (attempt + 1))
    raise RuntimeError(f"failed: {url}")


class Text(HTMLParser):
    """Minimal HTML → text: keeps block structure, drops scripts/nav/footer."""
    SKIP = {"script", "style", "nav", "footer", "header", "noscript", "svg", "button"}
    BLOCK = {"p", "div", "br", "li", "tr", "h1", "h2", "h3", "h4", "h5", "h6", "section", "article", "table", "dd", "dt"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out, self.skip = [], 0

    def handle_starttag(self, tag, attrs):
        if tag in self.SKIP:
            self.skip += 1
        elif tag in self.BLOCK:
            self.out.append("\n")
        if tag in ("h1", "h2", "h3") and not self.skip:
            self.out.append("#" * int(tag[1]) + " ")
        if tag == "li" and not self.skip:
            self.out.append("- ")

    def handle_endtag(self, tag):
        if tag in self.SKIP and self.skip:
            self.skip -= 1
        elif tag in self.BLOCK:
            self.out.append("\n")

    def handle_data(self, d):
        if not self.skip:
            self.out.append(d)


def html_to_text(src, main_only=True):
    if main_only:
        for pat in (r"<main\b.*?</main>", r"<article\b.*?</article>"):
            m = re.search(pat, src, flags=re.S | re.I)
            if m and len(m.group(0)) > 1500:
                src = m.group(0)
                break
    p = Text()
    p.feed(src)
    t = "".join(p.out).replace("\xa0", " ")
    t = re.sub(r"[ \t]+", " ", t)
    t = re.sub(r"\n\s*\n\s*\n+", "\n\n", t)
    return "\n".join(line.strip() for line in t.splitlines()).strip()


def header(meta):
    lines = [f"# {meta['title']}", "",
             f"- Source: {meta['source_url']}",
             f"- Issuer: {meta['issuer']}",
             f"- Jurisdiction: {meta['jurisdiction']} | Language: {meta['language']}",
             f"- Retrieved: {TODAY}", "", "---", ""]
    return "\n".join(lines)


def save_text(meta, body):
    path = DATA / meta["path"]
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(header(meta) + body.strip() + "\n", encoding="utf-8")
    print(f"   -> {meta['path']} ({len(body)} chars)")


def base_meta(doc_id, folder, fname, jurisdiction, lang, themes, title, issuer, doc_date, url, doc_type):
    top = folder.split("/")[0]
    return {"id": doc_id, "path": f"{folder}/{fname}", "folder": top, "doc_type": doc_type,
            "title": title, "issuer": issuer, "jurisdiction": jurisdiction, "language": lang,
            "themes": themes, "date": doc_date, "status": "in_force" if top in ("01_legislation", "03_collective_agreements") else "published",
            "source_url": url, "synthetic": False, "base_weight": FOLDER_WEIGHTS[top]}


# --------------------------------------------------------------------------- fetchers
_justel_cache = {}
ART_RE = re.compile(r"(?m)^\s*(?:\[\d+\s*)?Art(?:ikel|\.)\s*([0-9]+[a-z]*(?:/[0-9]+)?)\.")


def justel_text(eli):
    if eli not in _justel_cache:
        r = get(f"https://www.ejustice.just.fgov.be/eli/{eli}/justel")
        src = r.content.decode("latin1")
        src = re.sub(r"<br\s*/?>", "\n", src, flags=re.I)
        t = html.unescape(re.sub(r"<[^>]+>", "", src)).replace("\xa0", " ")
        _justel_cache[eli] = t
        time.sleep(1.5)
    return _justel_cache[eli]


def justel_articles(text, wanted):
    starts = [(m.start(), m.group(1)) for m in ART_RE.finditer(text)]
    blocks = {}
    for i, (pos, num) in enumerate(starts):
        end = starts[i + 1][0] if i + 1 < len(starts) else len(text)
        block = text[pos:end].strip()
        if len(block) > len(blocks.get(num, "")):
            blocks[num] = block
    out, missing = [], []
    for w in wanted:
        if w in blocks:
            out.append(re.sub(r"[ \t]+", " ", blocks[w]))
        else:
            missing.append(w)
    return "\n\n".join(out), missing


def fetch_justel(item):
    doc_id, eli, lang, arts, themes, title, d = item
    meta = base_meta(doc_id, "01_legislation/be_federal", f"{doc_id}.md", "BE", lang, themes, title,
                     "SPF Justice – Moniteur belge / Justel", d,
                     f"https://www.ejustice.just.fgov.be/eli/{eli}/justel", "legislation")
    text = justel_text(eli)
    if arts is None:
        i = text.find("Texte")
        body = text[i:] if i > 0 else text
        body = re.sub(r"\n\s*\n+", "\n\n", body)[:60000]
    else:
        body, missing = justel_articles(text, arts)
        if missing:
            print(f"   !! missing articles {missing}")
        if not body:
            raise RuntimeError("no articles extracted")
    save_text(meta, body)
    return meta


def cellar_items(celex, lang="ENG"):
    q = f"""PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
SELECT ?item ?t WHERE {{ ?w cdm:resource_legal_id_celex "{celex}"^^<http://www.w3.org/2001/XMLSchema#string> .
?e cdm:expression_belongs_to_work ?w ; cdm:expression_uses_language <http://publications.europa.eu/resource/authority/language/{lang}> .
?m cdm:manifestation_manifests_expression ?e ; cdm:manifestation_type ?t . ?item cdm:item_belongs_to_manifestation ?m .
FILTER(str(?t) IN ("xhtml","html")) }}"""
    r = get("https://publications.europa.eu/webapi/rdf/sparql", min_len=100, params={"query": q},
            headers={"Accept": "application/sparql-results+json"})
    items = [b["item"]["value"] for b in r.json()["results"]["bindings"]]
    if not items:
        raise RuntimeError(f"no CELLAR item for {celex}")
    return items


def cellar_text(celex):
    best = ""
    for u in cellar_items(celex):
        try:
            t = html_to_text(get(u).content.decode("utf-8", "ignore"), main_only=False)
        except RuntimeError:
            continue
        if len(t) > len(best):
            best = t
    return best


def eu_articles(text, wanted):
    starts = [(m.start(), m.group(1)) for m in re.finditer(r"(?m)^Article\s+(\d+)\s*$", text)]
    blocks = {}
    for i, (pos, num) in enumerate(starts):
        end = starts[i + 1][0] if i + 1 < len(starts) else len(text)
        blocks.setdefault(num, text[pos:end].strip())
    missing = [w for w in wanted if w not in blocks]
    return "\n\n".join(blocks[w] for w in wanted if w in blocks), missing


def fetch_eu(item):
    doc_id, celex, arts, themes, title, d = item
    meta = base_meta(doc_id, "01_legislation/eu", f"{doc_id}.md", "EU", "en", themes, title,
                     "Publications Office of the European Union (EUR-Lex / CELLAR)", d,
                     f"https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:{celex}", "legislation")
    text = cellar_text(celex)
    body, missing = eu_articles(text, arts)
    if missing:
        print(f"   !! missing articles {missing}")
    if not body:
        raise RuntimeError("no articles extracted")
    save_text(meta, body)
    return meta


def fetch_cjeu(item):
    doc_id, celex, themes, title, d = item
    meta = base_meta(doc_id, "02_case_law", f"{doc_id}.md", "EU", "en", themes, title,
                     "Court of Justice of the European Union", d,
                     f"https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:{celex}", "case_law")
    body = cellar_text(celex)
    if len(body) < 5000:
        raise RuntimeError("judgment text too short")
    save_text(meta, body)
    return meta


def fetch_hudoc(item):
    doc_id, itemid, themes, title, d = item
    url = f"https://hudoc.echr.coe.int/app/conversion/docx/?library=ECHR&id={itemid}&filename={doc_id}.docx"
    meta = base_meta(doc_id, "02_case_law", f"{doc_id}.docx", "COE", "en", themes, title,
                     "European Court of Human Rights", d, f"https://hudoc.echr.coe.int/eng?i={itemid}", "case_law")
    r = get(url)
    (DATA / meta["path"]).write_bytes(r.content)
    print(f"   -> {meta['path']} ({len(r.content)} B)")
    return meta


def fetch_cnt(item):
    doc_id, num, themes, title, d = item
    url = f"https://cnt-nar.be/sites/default/files/documents/CCT-COORD/cct-{num}.pdf"
    meta = base_meta(doc_id, "03_collective_agreements", f"{doc_id}.pdf", "BE", "fr", themes, title,
                     "Conseil National du Travail (CNT/NAR)", d, url, "collective_agreement")
    r = get(url)
    if not r.content.startswith(b"%PDF"):
        raise RuntimeError("not a PDF")
    (DATA / meta["path"]).write_bytes(r.content)
    print(f"   -> {meta['path']} ({len(r.content)} B)")
    return meta


def fetch_web(item):
    doc_id, url, folder, jur, lang, themes, title, issuer, d, span = item
    doc_type = {"01_legislation": "legislation", "04_official_guidance": "official_guidance",
                "13_external_secondary": "secondary_article"}[folder.split("/")[0]]
    meta = base_meta(doc_id, folder, f"{doc_id}.md", jur, lang, themes, title, issuer, d, url, doc_type)
    r = get(url)
    if isinstance(span, list):  # wetten.overheid.nl: pick <div class="artikel" id="..._ArtikelX"> blocks
        src = r.content.decode("utf-8", "ignore")
        parts = re.split(r'(?=<div class="artikel" id=")', src)
        picked = [p for p in parts if re.match(r'<div class="artikel" id="[^"]*_(%s)"' % "|".join(map(re.escape, span)), p)]
        if not picked:
            raise RuntimeError("no article blocks found")
        body = "\n\n".join(html_to_text(p, main_only=False) for p in picked)
        ui = ("Toon relaties in LiDO", "Maak een permanente link", "Toon wetstechnische informatie",
              "Druk het regelingonderdeel af", "Sla het regelingonderdeel op", "- ...")
        body = "\n".join(l for l in body.splitlines() if not any(u in l for u in ui))
        body = re.sub(r"\n\s*\n\s*\n+", "\n\n", body)
        save_text(meta, body)
        if meta["date"] is None:
            meta["date"] = TODAY
        return meta
    body = html_to_text(r.content.decode(r.encoding or "utf-8", "ignore") if r.encoding else r.text,
                        main_only="wetten.overheid.nl" not in url)
    if span:
        a = body.find(span[0])
        b = body.find(span[1], a + 1) if a >= 0 else -1
        if a >= 0:
            body = body[a:b if b > a else a + 40000]
        else:
            print(f"   !! span start '{span[0]}' not found, keeping full text")
    if meta["date"] is None:
        m = re.search(r"(20[12]\d)-(\d\d)-(\d\d)|(\d\d)[/.](\d\d)[/.](20[12]\d)", body)
        meta["date"] = (m.group(0) if m and m.group(1) else f"{m.group(6)}-{m.group(5)}-{m.group(4)}") if m else TODAY
    if len(body) < 400:
        raise RuntimeError(f"page text too short ({len(body)})")
    save_text(meta, body[:60000])
    return meta


# --------------------------------------------------------------------------- main
def main():
    only = set(sys.argv[sys.argv.index("--only") + 1:]) if "--only" in sys.argv else None
    catalog = {m["id"]: m for m in json.loads(CATALOG.read_text())} if CATALOG.exists() else {}
    jobs = ([(fetch_justel, i) for i in JUSTEL] + [(fetch_eu, i) for i in EU_LAW] + [(fetch_cjeu, i) for i in CJEU]
            + [(fetch_hudoc, i) for i in HUDOC] + [(fetch_cnt, i) for i in CNT] + [(fetch_web, i) for i in WEB])
    failed = []
    for fn, item in jobs:
        if only and item[0] not in only:
            continue
        print(f"[{fn.__name__}] {item[0]}")
        try:
            catalog[item[0]] = fn(item)
        except Exception as e:  # keep going, report at the end
            print(f"   FAILED: {e}")
            failed.append(item[0])
    CATALOG.write_text(json.dumps(list(catalog.values()), indent=1, ensure_ascii=False))
    print(f"\n{len(catalog)} real documents in catalog, {len(failed)} failed: {failed}")


if __name__ == "__main__":
    main()
