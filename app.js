/*
 * Motore per la narrativa interattiva "Il Castello".
 *
 * Questo modulo in JavaScript carica un file di script scritto
 * secondo il Castello Script Language (CSL)【676761782552981†L25-L72】,
 * analizza le scene e le istruzioni e ne gestisce l’esecuzione.
 * Supporta la stampa di testo, la visualizzazione di immagini,
 * la navigazione tra scene, la gestione dello stato globale
 * (flag e inventario) e la presentazione di scelte multiple【676761782552981†L25-L72】.
 * Lo stile dell’interfaccia (colore di sfondo, colore del testo,
 * font e dimensione) può essere modificato dallo script tramite
 * i comandi `background`, `foreground`, `font` e `fontsize`【676761782552981†L88-L101】.
 *
 * Per iniziare il gioco è necessario fornire un file "scenes.csl"
 * nella stessa directory di questo script contenente le definizioni
 * delle scene. La scena iniziale da caricare è "CH0".
 */

(function() {
    /**
     * Contenitori DOM principali.
     * `gameDiv` ospita il testo e le immagini generati durante
     * l’esecuzione delle scene.
     * `choicesDiv` contiene i pulsanti delle scelte quando presenti.
     */
    const gameDiv = document.getElementById('game');
    const choicesDiv = document.getElementById('choices');

    // Costruiamo una UI a 2 pannelli dentro #game
    const mediaDiv = document.createElement('div');
    mediaDiv.className = 'scene-media';
    
    const textDiv = document.createElement('div');
    textDiv.className = 'scene-text';
    
    // Spostiamo il contenitore scelte dentro il pannello testo
    textDiv.appendChild(choicesDiv);
    
    // Montiamo i pannelli dentro #game
    gameDiv.appendChild(mediaDiv);
    gameDiv.appendChild(textDiv);

    
    /**
     * Stato globale del gioco. Mantiene due insiemi: uno per le
     * variabili impostate tramite i comandi `set` e `unset`, e uno
     * per gli oggetti aggiunti/rimossi con `add` e `remove`【676761782552981†L53-L56】.
     * Le funzioni `setFlag`, `unsetFlag`, `addItem` e `removeItem`
     * manipolano questi insiemi.
     */
    const state = {
        flags: new Set(),
        inventory: new Set()
    };
    function setFlag(name) {
        state.flags.add(name);
    }
    function unsetFlag(name) {
        state.flags.delete(name);
    }
    function addItem(name) {
        state.inventory.add(name);
    }
    function removeItem(name) {
        state.inventory.delete(name);
    }
    function has(name) {
        return state.flags.has(name) || state.inventory.has(name);
    }

    /**
     * Stato corrente dello stile grafico. Inizialmente vengono
     * impostati i valori consigliati dal PDF: sfondo nero,
     * testo avorio, font Garamond/serif e dimensione 16【676761782552981†L115-L127】.
     * I comandi di stile dello script modificano queste proprietà.
     */
    const styleState = {
        background: '#000000',
        foreground: '#f5f5dc',
        font: "'Garamond', serif",
        fontsize: 16
    };

    /**
     * Applica lo stile corrente (sfondo, colore, font e dimensione) al
     * documento. Viene richiamata dopo ogni modifica di stile.
     */
    function applyGlobalStyle() {
        document.body.style.backgroundColor = styleState.background;
        document.body.style.color = styleState.foreground;
        document.body.style.fontFamily = styleState.font;
        document.body.style.fontSize = styleState.fontsize + 'px';
    }
    // Applica lo stile iniziale alla pagina.
    applyGlobalStyle();

    /**
     * Stampa una riga di testo sullo schermo. Ogni riga viene
     * racchiusa in un elemento <p> con class `game-line` e riceve
     * gli stessi attributi di stile attuali (colore, font,
     * dimensione). Le interruzioni di riga sono preservate【676761782552981†L115-L123】.
     * @param {string} text Testo da visualizzare.
     */
    function printLine(text) {
      const p = document.createElement('p');
      p.className = 'game-line';
      p.textContent = text;
      p.style.color = styleState.foreground;
      p.style.fontFamily = styleState.font;
      p.style.fontSize = styleState.fontsize + 'px';
      textDiv.insertBefore(p, choicesDiv); // testo nel pannello destro, sopra le scelte
    }

    /**
     * Visualizza un’immagine sullo schermo. L’elemento <img> creato
     * utilizza la classe `game-image` per il ridimensionamento e
     * l’allineamento. Se il percorso non esiste (le immagini non
     * vengono fornite in questo pacchetto), il browser mostrerà un
     * segnaposto vuoto.
     * @param {string} src Percorso dell’immagine.
     */
    function showImage(src) {
      const img = document.createElement('img');
      img.className = 'game-image';
      img.src = src;
      img.alt = '';
      mediaDiv.appendChild(img); // immagine nel pannello sinistro
    }

    /**
     * Scorre la finestra fino al fondo della pagina per mostrare
     * l’ultima riga stampata o immagine visualizzata.
     */
    function scrollToBottom() {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }

    /**
     * Mostra una serie di scelte all’utente e attende la selezione.
     * Ogni scelta è rappresentata come un oggetto con un testo e
     * un array di istruzioni da eseguire dopo la selezione.
     * Restituisce una Promise risolta con l’array di istruzioni
     * della scelta selezionata.
     * @param {Array<{text:string, statements:Array}>} choiceBlocks
     */
    function handleChoices(choiceBlocks) {
        // Cancella eventuali scelte precedenti
        choicesDiv.innerHTML = '';
        return new Promise(resolve => {
            choiceBlocks.forEach(choice => {
                const btn = document.createElement('button');
                btn.className = 'choice-button';
                btn.textContent = choice.text;
                btn.addEventListener('click', () => {
                    // Rimuove i pulsanti dopo la selezione
                    choicesDiv.innerHTML = '';
                    resolve(choice.statements);
                });
                choicesDiv.appendChild(btn);
            });
        });
    }

    /**
     * Rimuove i commenti da una riga di script, ignorando i
     * puntatori di commento ';' presenti all’interno di stringhe.
     * @param {string} line
     * @returns {string}
     */
    function stripComments(line) {
        let result = '';
        let inString = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '\\') {
                // Carattere di escape: copia il carattere e il successivo
                result += ch;
                if (i + 1 < line.length) {
                    result += line[i + 1];
                    i++;
                }
                continue;
            }
            if (ch === '"') {
                inString = !inString;
                result += ch;
                continue;
            }
            if (ch === ';' && !inString) {
                // Inizia un commento, scarta il resto della linea
                break;
            }
            result += ch;
        }
        return result;
    }

    /**
     * Analizza un literal di stringa racchiuso tra doppi apici. Gestisce
     * le sequenze di escape come \" per il doppio apice, \\ per la
     * barra inversa, \n e \t per nuove righe e tabulazioni【676761782552981†L16-L18】.
     * @param {string} s La stringa completa da analizzare
     * @param {number} start Indice del primo apice
     * @returns {{value:string, endIndex:number}}
     */
    function parseStringLiteral(s, start) {
        let i = start + 1;
        let out = '';
        while (i < s.length) {
            const ch = s[i];
            if (ch === '\\') {
                i++;
                if (i >= s.length) break;
                const next = s[i];
                switch (next) {
                    case 'n':
                        out += '\n';
                        break;
                    case 't':
                        out += '\t';
                        break;
                    case '"':
                        out += '"';
                        break;
                    case '\\':
                        out += '\\';
                        break;
                    default:
                        // carattere non riconosciuto: copialo
                        out += next;
                        break;
                }
                i++;
                continue;
            }
            if (ch === '"') {
                // Fine della stringa
                i++;
                return { value: out, endIndex: i };
            }
            out += ch;
            i++;
        }
        // Se arriviamo qui la stringa non è stata chiusa
        throw new Error('Stringa non terminata');
    }

    /**
     * Analizza il file di script CSL e restituisce un dizionario di scene.
     * Ogni scena è identificata da un ID e contiene un array di
     * istruzioni già strutturate come oggetti.
     * @param {string} text Contenuto del file .csl
     * @returns {Object<string,Array>}
     */
    function parseScript(text) {
        const lines = text.split(/\r?\n/);
        let idx = 0;
        const scenes = {};

        // Funzione per analizzare una sequenza di istruzioni fino al termine
        // della scena corrente. Termina quando incontra la definizione di
        // una nuova scena o la fine del file.
        function parseSceneStatements() {
            const statements = [];
            while (idx < lines.length) {
                let rawLine = lines[idx];
                let trimmed = stripComments(rawLine).trim();
                // Salta righe vuote o commenti
                if (trimmed.length === 0) {
                    idx++;
                    continue;
                }
                // Fine della scena se trova una nuova definizione di scena
                if (/^scene\b/i.test(trimmed)) {
                    break;
                }
                // Analizza una singola istruzione
                const stmt = parseStatement(trimmed);
                if (stmt !== null) {
                    statements.push(stmt);
                }
            }
            return statements;
        }

        // Analizza un blocco di istruzioni (usato per 'if' e 'choice'),
        // fermandosi quando trova una delle parole di stop (else/end).
        function parseBlock(stopTokens) {
            const statements = [];
            while (idx < lines.length) {
                let rawLine = lines[idx];
                let trimmed = stripComments(rawLine).trim();
                if (trimmed.length === 0) {
                    idx++;
                    continue;
                }
                // Controlla se la riga inizia con uno dei token di stop
                const lower = trimmed.toLowerCase();
                for (const tok of stopTokens) {
                    if (lower.startsWith(tok)) {
                        return { statements, stopToken: tok };
                    }
                }
                const stmt = parseStatement(trimmed);
                if (stmt !== null) {
                    statements.push(stmt);
                }
            }
            // Fine file
            return { statements, stopToken: null };
        }

        // Analizza una singola istruzione in base alla prima parola
        function parseStatement(trimmed) {
            // Determina la parola chiave
            const firstSpace = trimmed.search(/\s/);
            const keyword = (firstSpace === -1 ? trimmed : trimmed.substring(0, firstSpace)).toLowerCase();
            switch (keyword) {
                case 'print': {
                    // Estrarre la stringa dopo la parola chiave
                    const startQuote = trimmed.indexOf('"');
                    if (startQuote === -1) {
                        throw new Error('print senza stringa');
                    }
                    const { value, endIndex } = parseStringLiteral(trimmed, startQuote);
                    idx++;
                    return { type: 'print', value };
                }
                case 'image': {
                    const startQuote = trimmed.indexOf('"');
                    if (startQuote === -1) {
                        throw new Error('image senza stringa');
                    }
                    const { value, endIndex } = parseStringLiteral(trimmed, startQuote);
                    idx++;
                    return { type: 'image', value };
                }
                case 'go': {
                    const parts = trimmed.split(/\s+/);
                    if (parts.length < 2) {
                        throw new Error('go senza destinazione');
                    }
                    idx++;
                    return { type: 'go', target: parts[1] };
                }
                case 'set': {
                    const parts = trimmed.split(/\s+/);
                    if (parts.length < 2) {
                        throw new Error('set senza identificatore');
                    }
                    idx++;
                    return { type: 'set', id: parts[1] };
                }
                case 'unset': {
                    const parts = trimmed.split(/\s+/);
                    if (parts.length < 2) {
                        throw new Error('unset senza identificatore');
                    }
                    idx++;
                    return { type: 'unset', id: parts[1] };
                }
                case 'add': {
                    const parts = trimmed.split(/\s+/);
                    if (parts.length < 2) {
                        throw new Error('add senza identificatore');
                    }
                    idx++;
                    return { type: 'add', id: parts[1] };
                }
                case 'remove': {
                    const parts = trimmed.split(/\s+/);
                    if (parts.length < 2) {
                        throw new Error('remove senza identificatore');
                    }
                    idx++;
                    return { type: 'remove', id: parts[1] };
                }
                case 'background': {
                    // L’argomento è un colore (identificatore o esadecimale)
                    const parts = trimmed.split(/\s+/);
                    if (parts.length < 2) {
                        throw new Error('background senza valore');
                    }
                    idx++;
                    return { type: 'style', property: 'background', value: parts[1] };
                }
                case 'foreground': {
                    const parts = trimmed.split(/\s+/);
                    if (parts.length < 2) {
                        throw new Error('foreground senza valore');
                    }
                    idx++;
                    return { type: 'style', property: 'foreground', value: parts[1] };
                }
                case 'font': {
                    // Può essere stringa con spazi (tra apici) o identificatore
                    // Cerchiamo se c’è un apice
                    const quoteIndex = trimmed.indexOf('"');
                    let fontValue;
                    if (quoteIndex !== -1) {
                        const { value } = parseStringLiteral(trimmed, quoteIndex);
                        fontValue = value;
                    } else {
                        const parts = trimmed.split(/\s+/);
                        if (parts.length < 2) {
                            throw new Error('font senza valore');
                        }
                        fontValue = parts[1];
                    }
                    idx++;
                    return { type: 'style', property: 'font', value: fontValue };
                }
                case 'fontsize': {
                    const parts = trimmed.split(/\s+/);
                    if (parts.length < 2) {
                        throw new Error('fontsize senza valore');
                    }
                    const size = parseInt(parts[1], 10);
                    if (isNaN(size)) {
                        throw new Error('fontsize non valido');
                    }
                    idx++;
                    return { type: 'style', property: 'fontsize', value: size };
                }
                case 'choice': {
                    // La sintassi è: choice "testo"\n  ... istruzioni ...\nend
                    const quoteStart = trimmed.indexOf('"');
                    if (quoteStart === -1) {
                        throw new Error('choice senza stringa');
                    }
                    const { value: text } = parseStringLiteral(trimmed, quoteStart);
                    idx++;
                    // Analizza il corpo della scelta fino a "end"
                    const { statements: choiceStmts, stopToken } = parseBlock(['end']);
                    // Consumiamo la riga "end"
                    if (stopToken === 'end') {
                        // Avanza oltre "end"
                        idx++;
                    }
                    return { type: 'choice', text, statements: choiceStmts };
                }
                case 'if': {
                    // Trova la parola "then" per delimitare l’espressione booleana
                    const tokens = trimmed.split(/\s+/);
                    // tokens[0] è 'if'
                    const thenIndex = tokens.findIndex(t => t.toLowerCase() === 'then');
                    if (thenIndex === -1) {
                        throw new Error('if senza then');
                    }
                    const condTokens = tokens.slice(1, thenIndex);
                    const condString = condTokens.join(' ');
                    const condAst = parseBoolExpr(condString);
                    // Dopo 'then' la linea termina: le istruzioni iniziano dalla
                    // riga successiva (line_end)
                    idx++;
                    // Analizza ramo then fino a "else" o "end"
                    const { statements: thenStmts, stopToken } = parseBlock(['else', 'end']);
                    let elseStmts = [];
                    if (stopToken === 'else') {
                        // Consuma la riga "else"
                        idx++;
                        // Analizza ramo else fino a "end"
                        const result2 = parseBlock(['end']);
                        elseStmts = result2.statements;
                        // Consuma la riga "end"
                        idx++;
                    } else if (stopToken === 'end') {
                        // Già sul token end: consumiamo "end"
                        idx++;
                    }
                    return { type: 'if', condition: condAst, thenStmts, elseStmts };
                }
                default: {
                    // I token 'else' ed 'end' vengono gestiti nei blocchi
                    // Non dovrebbero arrivare qui, quindi restituiamo null
                    return null;
                }
            }
        }

        // Analizza le scene nel file
        while (idx < lines.length) {
            let rawLine = lines[idx];
            let trimmed = stripComments(rawLine).trim();
            if (trimmed.length === 0) {
                idx++;
                continue;
            }
            // Definizione di una nuova scena
            if (/^scene\b/i.test(trimmed)) {
                const parts = trimmed.split(/\s+/);
                if (parts.length < 2) {
                    throw new Error('scene senza identificatore');
                }
                const sceneId = parts[1];
                idx++;
                const statements = parseSceneStatements();
                scenes[sceneId] = statements;
            } else {
                // Linea al di fuori di una scena: ignorala
                idx++;
            }
        }
        return scenes;
    }

    /**
     * Tokenizza un’espressione booleana secondo la grammatica del CSL【676761782552981†L74-L85】.
     * Restituisce un array di token con proprietà `type` e `value`. I
     * token riservati (and, or, not, has, true, false) vengono
     * convertiti in minuscolo per coerenza.
     * @param {string} expr
     * @returns {Array}
     */
    function tokenizeBoolExpr(expr) {
        const tokens = [];
        let i = 0;
        while (i < expr.length) {
            const ch = expr[i];
            // Salta spazi
            if (/\s/.test(ch)) {
                i++;
                continue;
            }
            if (ch === '(' || ch === ')') {
                tokens.push({ type: ch, value: ch });
                i++;
                continue;
            }
            if (/[A-Za-z0-9_]/.test(ch)) {
                let j = i;
                while (j < expr.length && /[A-Za-z0-9_]/.test(expr[j])) {
                    j++;
                }
                const word = expr.slice(i, j);
                const lower = word.toLowerCase();
                switch (lower) {
                    case 'and':
                    case 'or':
                    case 'not':
                    case 'has':
                    case 'true':
                    case 'false':
                        tokens.push({ type: lower, value: lower });
                        break;
                    default:
                        tokens.push({ type: 'identifier', value: word });
                        break;
                }
                i = j;
                continue;
            }
            // Carattere non riconosciuto
            throw new Error('Carattere non valido nell’espressione booleana: ' + ch);
        }
        return tokens;
    }

    /**
     * Analizza una lista di token in un AST per le espressioni booleane.
     * Usa ricorsione per supportare precedenza e parentesi【676761782552981†L74-L85】.
     * Restituisce un oggetto con proprietà `ast` e l’indice finale.
     * @param {Array} tokens
     * @param {number} start
     * @returns {{ast: any, index: number}}
     */
    function parseBoolTokens(tokens, start = 0) {
        // Forward declarations
        function parseOr(i) {
            let { ast: left, index } = parseAnd(i);
            while (index < tokens.length && tokens[index].type === 'or') {
                index++; // consuma 'or'
                const { ast: right, index: newIndex } = parseAnd(index);
                left = { type: 'or', left, right };
                index = newIndex;
            }
            return { ast: left, index };
        }
        function parseAnd(i) {
            let { ast: left, index } = parseNot(i);
            while (index < tokens.length && tokens[index].type === 'and') {
                index++; // consuma 'and'
                const { ast: right, index: newIndex } = parseNot(index);
                left = { type: 'and', left, right };
                index = newIndex;
            }
            return { ast: left, index };
        }
        function parseNot(i) {
            if (i < tokens.length && tokens[i].type === 'not') {
                // consuma 'not'
                const { ast: operand, index: newIndex } = parseNot(i + 1);
                return { ast: { type: 'not', operand }, index: newIndex };
            }
            return parseAtom(i);
        }
        function parseAtom(i) {
            if (i >= tokens.length) {
                throw new Error('Espressione booleana non valida');
            }
            const tok = tokens[i];
            switch (tok.type) {
                case '(': {
                    const { ast: expr, index: newIndex } = parseOr(i + 1);
                    if (newIndex >= tokens.length || tokens[newIndex].type !== ')') {
                        throw new Error('Parentesi non bilanciate');
                    }
                    return { ast: expr, index: newIndex + 1 };
                }
                case 'has': {
                    if (i + 1 >= tokens.length || tokens[i + 1].type !== 'identifier') {
                        throw new Error('Uso di has senza identificatore');
                    }
                    const idToken = tokens[i + 1];
                    return { ast: { type: 'has', name: idToken.value }, index: i + 2 };
                }
                case 'identifier': {
                    return { ast: { type: 'ident', name: tok.value }, index: i + 1 };
                }
                case 'true': {
                    return { ast: { type: 'true' }, index: i + 1 };
                }
                case 'false': {
                    return { ast: { type: 'false' }, index: i + 1 };
                }
                default:
                    throw new Error('Token non riconosciuto nell’espressione booleana: ' + tok.type);
            }
        }
        return parseOr(start);
    }

    /**
     * Analizza una stringa di espressione booleana e restituisce un AST.
     * @param {string} exprString
     * @returns {any}
     */
    function parseBoolExpr(exprString) {
        const tokens = tokenizeBoolExpr(exprString);
        const { ast, index } = parseBoolTokens(tokens);
        if (index < tokens.length) {
            throw new Error('Token residui dopo l’espressione booleana');
        }
        return ast;
    }

    /**
     * Valuta un AST booleano in base allo stato corrente (flags e inventario).
     * @param {any} node L’AST da valutare
     * @returns {boolean}
     */
    function evalBool(node) {
        switch (node.type) {
            case 'or':
                return evalBool(node.left) || evalBool(node.right);
            case 'and':
                return evalBool(node.left) && evalBool(node.right);
            case 'not':
                return !evalBool(node.operand);
            case 'has':
            case 'ident':
                return has(node.name);
            case 'true':
                return true;
            case 'false':
                return false;
            default:
                throw new Error('Tipo di nodo booleano sconosciuto: ' + node.type);
        }
    }

    /**
     * Esegue un array di istruzioni secondo la semantica del CSL. Le
     * istruzioni possono includere stampa, immagini, stile, gestione
     * dello stato, salti di scena, condizioni e scelte【676761782552981†L25-L72】.
     * @param {Array} statements
     * @returns {Promise<void>}
     */
    async function runStatements(statements) {
        for (let i = 0; i < statements.length; i++) {
            const stmt = statements[i];
            switch (stmt.type) {
                case 'print':
                    printLine(stmt.value);
                    break;
                case 'image':
                    showImage(stmt.value);
                    break;
                case 'set':
                    setFlag(stmt.id);
                    break;
                case 'unset':
                    unsetFlag(stmt.id);
                    break;
                case 'add':
                    addItem(stmt.id);
                    break;
                case 'remove':
                    removeItem(stmt.id);
                    break;
                case 'style':
                    {
                        const prop = stmt.property;
                        const val = stmt.value;
                        if (prop === 'background') {
                            styleState.background = val;
                            applyGlobalStyle();
                        } else if (prop === 'foreground') {
                            styleState.foreground = val;
                            applyGlobalStyle();
                        } else if (prop === 'font') {
                            // se il font contiene spazi, racchiudilo in apici
                            // In JS, font-family può essere una lista, la virgola e gli apici sono gestiti nel file CSS
                            styleState.font = val;
                            applyGlobalStyle();
                        } else if (prop === 'fontsize') {
                            styleState.fontsize = val;
                            applyGlobalStyle();
                        }
                    }
                    break;
                case 'if':
                    {
                        const condition = evalBool(stmt.condition);
                        if (condition) {
                            const res = await runStatements(stmt.thenStmts);
                            // se una chiamata a go ha effettuato un salto di scena, interrompi
                            if (res === 'goto') {
                                return 'goto';
                            }
                        } else if (stmt.elseStmts && stmt.elseStmts.length > 0) {
                            const res = await runStatements(stmt.elseStmts);
                            if (res === 'goto') {
                                return 'goto';
                            }
                        }
                    }
                    break;
                case 'go':
                    // Naviga verso la scena indicata
                    await runScene(stmt.target);
                    return 'goto';
                case 'choice':
                    {
                        // Raccoglie tutte le scelte consecutive
                        const choiceList = [];
                        let j = i;
                        while (j < statements.length && statements[j].type === 'choice') {
                            choiceList.push(statements[j]);
                            j++;
                        }
                        // Spostiamo l’indice alla fine del blocco di scelte
                        i = j - 1;
                        // Visualizza le scelte e aspetta la selezione
                        const selectedStatements = await handleChoices(choiceList);
                        // Esegui le istruzioni associate alla scelta selezionata
                        const res = await runStatements(selectedStatements);
                        if (res === 'goto') {
                            return 'goto';
                        }
                        // Dopo aver eseguito la scelta, prosegue con le
                        // istruzioni rimanenti (non incluse nelle scelte)
                        continue;
                    }
                default:
                    // Tipo non riconosciuto: ignoralo
                    break;
            }
        }
        return;
    }

    /**
     * Esegue una scena individuata dal suo ID. Pulisce il contenuto
     * della zona scelte prima di iniziare. Se la scena non esiste,
     * stampa un messaggio di errore.
     * @param {string} sceneId
     */
    async function runScene(sceneId) {
      // Pulisce la scena precedente (testo + immagini)
      mediaDiv.innerHTML = '';
      // rimuovi tutte le righe testo ma NON il contenitore scelte
      Array.from(textDiv.querySelectorAll('.game-line')).forEach(el => el.remove());
    
      // Rimuove eventuali scelte residue
      choicesDiv.innerHTML = '';
    
      const scene = scenes[sceneId];
      if (!scene) {
        printLine('Scena non trovata: ' + sceneId);
        return;
      }
      await runStatements(scene);
    }

    /**
     * Avvia il gioco. Carica il file "scenes.csl", lo analizza e
     * avvia l’esecuzione dalla scena "CH0"【676761782552981†L27-L29】. In caso di
     * errore durante il caricamento o l’analisi, visualizza il messaggio
     * d’errore all’utente.
     */
    async function startGame() {
        try {
            let text = '';
            // Prima prova a leggere il contenuto dello script dal tag
            // <script id="csl-script" type="text/plain"> all’interno della pagina.
            const embedded = document.getElementById('csl-script');
            if (embedded && embedded.textContent.trim().length > 0) {
                text = embedded.textContent;
            } else {
                // In assenza di script incorporato, prova a caricare scenes.csl.
                const response = await fetch('scenes.csl');
                if (!response.ok) {
                    throw new Error('Impossibile caricare il file scenes.csl');
                }
                text = await response.text();
            }
            scenes = parseScript(text);
            await runScene('CH0');
        } catch (err) {
            printLine('Errore: ' + err.message);
            console.error(err);
        }
    }

    // Oggetto che conterrà tutte le scene dopo il parsing
    let scenes = {};
    // Avvio del gioco al caricamento della pagina
    window.addEventListener('DOMContentLoaded', startGame);
})();
