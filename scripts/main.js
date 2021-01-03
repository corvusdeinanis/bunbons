/*

TODO:
- planet images
- toy images
- finish food images
- pre-load face images

BUGS:
- random pauses every so often, at least in Firefox (cause: cc graph reduction, aka c++ garbage collection)
- slowdown over time?
- fix save & load - better saving strategy, new planet has the same bunbons as the old planet after blasting off

*/

let DEBUG = true

let FRAME_RATE = 30

let CANVAS_SCALE = 2

let SPACE_WIDTH = 640
let SPACE_HEIGHT = 480

let WORLD_WIDTH = 320
let WORLD_HEIGHT = 200
let WORLD_DIST = Math.sqrt(WORLD_WIDTH * WORLD_WIDTH + WORLD_HEIGHT * WORLD_HEIGHT)

let SCREEN_WIDTH = 320
let SCREEN_HEIGHT = 240

let inventory = {
    x: 40,
    y: WORLD_HEIGHT + 5,
    slotCount: 6,
    slotWidth: 40,
    width: 40 * 6,
    height: 32
} 

let spaceButton = {
    x: 4,
    y: WORLD_HEIGHT + 5,
    width: 32,
    height: 32
}

let blastOffButton = {
    x: WORLD_WIDTH - 36,
    y: WORLD_HEIGHT + 5,
    width: 32,
    height: 32
}

let lastX = 0
let lastY = 0
let startX = 0
let startY = 0
let mouseVelocity = 0
let isClicking = false
let isDragging = false
let preventClicking = false

let confirmingBlastOff = false

p5.disableFriendlyErrors = true
let Vector = p5.Vector

let spritesheet, spritesheetImg, baseSpritesheet
let colorSpritesheets = {}

let userinterfaceImg, spaceButtonImg

let gameObjects = []
let inventoryObjects = Array(inventory.slotCount)
let blastedOffBunbons = []
let selectedBunbon = null
let selectedObject = null

let spaceScreen = new Space()
let planets = []
let unlockedPlanetCount = 0

let planetBGs = {}
let planetMasks = {}
let planetBG = null
let planetMask = null

let currentScreen = spaceScreen
let lastPlanet = null

let myFont

function openScreen(type, index, arg) {
    currentScreen.close()
    if (type === 'space') {
        currentScreen = spaceScreen
    }
    else if (type === 'planet') {
        currentScreen = planets[index]
    }
    currentScreen.open(index, arg)
}

function isPointPassable(x, y) {
    x = floor(x)
    y = floor(y)

    // out of bounds
    if (x < 0 || x >= WORLD_WIDTH) return false
    if (y < 0 || y >= WORLD_HEIGHT) return false

    // masked area
    let pixel = planetMask.get(x, y)
    if (pixel[0] >= 128) return false

    return true
}

function randomPoint() {
    let pos = null
    while (!pos) {
        let x = floor(random(0, WORLD_WIDTH))
        let y = floor(random(0, WORLD_HEIGHT))
        if (isPointPassable(x, y)) {
            pos = createVector(x, y)
        }
    }
    return pos
}

function isInInventory(x, y) {
    return (
        x >= inventory.x && x < inventory.x + inventory.width &&
        y >= inventory.y && y < inventory.y + inventory.height
    )
}

function getInventorySlot(x) {
    return min(max(floor((x - inventory.x) / inventory.slotWidth), 0), inventory.slotCount - 1)
}

function inventorySlotX(slot) {
    return inventory.x + (slot * inventory.slotWidth) + floor(inventory.slotWidth / 2)
}

function inventorySlotY() {
    return inventory.y + floor(inventory.height / 2) 
}

function boundPosition(obj) {
    if (obj.pos.x < 0) obj.pos.x = 0
    if (obj.pos.x > WORLD_WIDTH) obj.pos.x = WORLD_WIDTH
    if (obj.pos.y < 0) obj.pos.y = 0
    if (obj.pos.y > WORLD_HEIGHT) obj.pos.y = WORLD_HEIGHT
}

function preload() {
    myFont = loadFont('fonts/UbuntuMono-Bold.woff')

    spritesheetImg = loadImage('../images/spritesheet.png')
    userinterfaceImg = loadImage('../images/userinterface.png')

    planetBGs = {
        mossyforest: loadImage('../images/planets/mossyforest.png'),
        park: loadImage('../images/planets/park.png'),
        volcano: loadImage('../images/planets/volcano.png')
    }

    planetMasks = {
        mossyforest: loadImage('../images/planets/mossyforest-mask.png'),
        park: loadImage('../images/planets/park-mask.png'),
        volcano: loadImage('../images/planets/volcano-mask.png')
    }
}

function setup() {
    frameRate(FRAME_RATE)

    createCanvas(SCREEN_WIDTH * 2, SCREEN_HEIGHT * 2)
    noSmooth()
    strokeCap(ROUND)
    strokeJoin(ROUND)
    strokeWeight(1)
    
    textFont(myFont)
    textSize(7)
    textAlign(CENTER, BASELINE)

    baseSpritesheet = new Spritesheet(spritesheetImg, 32, 32)
    Object.keys(bunbonColors).forEach(colorName => {
        colorSpritesheets[colorName] = baseSpritesheet.recolor(colorName)
    })
 
    spaceButtonImg = spritesheetImg.get(0, 606, 34, 34)

    planetBG = planetBGs.park
    planetMask = planetMasks.park

    spaceScreen.setup()
    let isLoadSuccessful = loadState()
    if (!isLoadSuccessful) {
        planets = Array(16).fill(0).map((x, i) => (new Planet(i, 'park')))
        planets.forEach(planet => planet.setup())
        planets[0].isUnlocked = true
    }

    let unlockedPlanets = planets.filter(p => p.isUnlocked)
    unlockedPlanetCount = unlockedPlanets.length
    if (unlockedPlanetCount === 1) {
        openScreen('planet', unlockedPlanets[0].index)
    } else {
        openScreen('space', 0)
    }
}

function draw() {
    let dx = abs(mouseX - lastX)
    let dy = abs(mouseY - lastY)
    lastX = mouseX
    lastY = mouseY
    mouseVelocity = (mouseVelocity + sqrt(dx * dx + dy * dy)) / 2

    clear()
    scale(CANVAS_SCALE)
    currentScreen.draw()
}

function touchStarted() {
    // duplicating mousePressed here because p5js has a bug in it
    if (preventClicking) return

    let x = mouseX / CANVAS_SCALE
    let y = mouseY / CANVAS_SCALE

    startX = x
    startY = y

    if (x >= 0 && y >= 0 && x < SCREEN_WIDTH && y < SCREEN_HEIGHT) {
        currentScreen.mousePressed(x, y)
        isClicking = true
    }
}

function mousePressed() {
    if (preventClicking) return

    let x = mouseX / CANVAS_SCALE
    let y = mouseY / CANVAS_SCALE

    startX = x
    startY = y
    
    if (x >= 0 && y >= 0 && x < SCREEN_WIDTH && y < SCREEN_HEIGHT) {
        currentScreen.mousePressed(x, y)
        isClicking = true
    }
}

function mouseDragged() {
    if (!isClicking) return

    let x = mouseX / CANVAS_SCALE
    let y = mouseY / CANVAS_SCALE

    if (x < 0) x = 0
    if (x >= SCREEN_WIDTH) x = SCREEN_WIDTH - 1
    if (y < 0) y = 0
    if (y >= SCREEN_HEIGHT) y = SCREEN_HEIGHT - 1

    let dx = startX - x
    let dy = startY - y

    currentScreen.mouseDragged(x, y, dx, dy)
}

function mouseReleased() {
    if (!isClicking) return

    let x = mouseX / CANVAS_SCALE
    let y = mouseY / CANVAS_SCALE

    if (x < 0) x = 0
    if (x >= SCREEN_WIDTH) x = SCREEN_WIDTH - 1
    if (y < 0) y = 0
    if (y >= SCREEN_HEIGHT) y = SCREEN_HEIGHT - 1

    let dx = startX - x
    let dy = startY - y

    currentScreen.mouseReleased(x, y, dx, dy)
    isClicking = false
}

function keyPressed() {
    currentScreen.keyPressed()
}

function saveState() {
    // let data = {
    //     planets: planets.map(p => p.export()),
    //     inventoryObjects: inventoryObjects.map(o => o ? o.export() : null)
    // }
    // try {
    //     dataString = JSON.stringify(data)
    //     window.localStorage.setItem('bunbons', dataString)
    // } catch(e) {
    //     if (DEBUG) console.error('unable to save', e)
    // }
}

function loadState() {
    // try {
    //     let dataString = window.localStorage.getItem('bunbons')
    //     let data = dataString ? JSON.parse(dataString) : null
    //     if (data) {
    //         if (data.planets) planets = data.planets.map(p => Planet.import(p))
    //         if (data.inventoryObjects) inventoryObjects = data.inventoryObjects.map(o => GameObject.import(o))
    //         return true
    //     } else {
    //         throw 'bad data'
    //     }
    // } catch(e) {
    //     if (DEBUG) console.error('unable to load:', e)
    // }
}

function exportBunBon() {
    if (!(currentScreen instanceof Planet)) return

    if (selectedObject && selectedObject instanceof BunBon) {
        console.log('~ exporting ' + selectedObject.name + ' ~')
        let data = selectedObject.export()
        try {
            let dataString = JSON.stringify(data)
            console.log(dataString)
        } catch(e) {
            console.error('unable to export:', e)
        }
    }
}

function importBunBon(dataString) {
    if (!(currentScreen instanceof Planet)) return

    try {
        let data = dataString ? JSON.parse(dataString) : null
        if (data) {
            if (data.type === 'bunbon') {
                console.log('~ importing ' + data.name + ' ~')
                let newBunBon = BunBon.import(data)
                currentScreen.objects.push(newBunBon)
                // todo: load the bunbon in a random valid location
            }
        } else {
            throw 'bad data'
        }
    } catch(e) {
        console.error('unable to import:', e)
    }
}