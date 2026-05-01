# Setup Guide - STS2 Analytics

## Finding Your STS2 Save Folder

Your `.run` files are stored in:

```text
C:\Users\[YOUR_USERNAME]\AppData\Roaming\SlayTheSpire2\steam\[YOUR_STEAM_ID]\profile1\saves\history
```

### How to Find Your Steam ID

1. **Open STS2 in Steam**
2. **Right-click game → Properties → Local Files → Browse**
   - This opens your STS2 installation folder
3. **Navigate up** to: `...\saves\history\`
4. **Copy the full path** - this is where `.run` files are stored

Alternatively:

- Open Windows Explorer
- Paste: `%APPDATA%\SlayTheSpire2\steam`
- Look for a folder with numbers (your Steam ID)
- Go to: `[STEAM_ID]\profile1\saves\history`

### Example Paths

**Current Configuration:**

```text
C:\Users\you\AppData\Roaming\SlayTheSpire2\steam\0000000000000000\profile1\saves\history
```

**Another User Example:**

```text
C:\Users\username\AppData\Roaming\SlayTheSpire2\steam\12345678901234567\profile1\saves\history
```

## Configuring for Your Setup

If you have a different username or Steam ID, update these files:

### 1. `src/analyze/extractRunData.ts` (Line ~20)

Current:

```typescript
const HISTORY_PATH = path.expandUser(
  "~/AppData/Roaming/SlayTheSpire2/steam/0000000000000000/profile1/saves/history"
).replace(/~/g, require("os").homedir());
```

Change to your path:

```typescript
const HISTORY_PATH = path.expandUser(
  "~/AppData/Roaming/SlayTheSpire2/steam/YOUR_STEAM_ID/profile1/saves/history"
).replace(/~/g, require("os").homedir());
```

### 2. `src/server/index.ts` (Line ~21)

Current:

```typescript
const HISTORY_PATH = (
  "C:\\Users\\you\\AppData\\Roaming\\SlayTheSpire2\\steam\\0000000000000000\\profile1\\saves\\history"
);
```

Change to:

```typescript
const HISTORY_PATH = (
  "C:\\Users\\YOUR_USERNAME\\AppData\\Roaming\\SlayTheSpire2\\steam\\YOUR_STEAM_ID\\profile1\\saves\\history"
);
```

### 3. `src/server/watcher.ts` (Line ~17)

Same change as above.

**Important:** Use `\\` (double backslash) in TypeScript strings for Windows paths!

## Verification

```bash
npm run dashboard

# Or run full analysis pipeline
npm run analyze
```

You should see output like:

```text
Found 188 run files
Loaded 188 runs from SQLite DB
Enhanced dashboard generated: C:\...\output\dashboard.html
```

If you get "No run files found", double-check your history path:

- Path must be exact (including Steam ID)
- `.run` files must exist in that folder
- Folder must be readable by Node.js

## Testing the Watcher

Once paths are configured, test auto-ingestion:

```bash
npm run watch
```

Play a run in STS2, and you should see in the terminal:

```text
Detected new file: 1775651903.run
Processing: 1775651903.run
Inserted run into database
```

---

**Need help?**

1. Check that `.run` files exist: `ls [YOUR_PATH]\*.run`
2. Verify the folder path: Open in Windows Explorer to confirm
3. Check file permissions: Ensure Node.js can read the folder
4. Run `npm run analyze` to manually test extraction
