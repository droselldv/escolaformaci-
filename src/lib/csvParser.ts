import {
  RawLumaGuest,
  ProcessedGuest,
  EventAnalysis,
  TableGroup,
  DishTotal,
  TableAssignmentsMap,
} from '../types';

/**
 * Robust CSV parser that handles quotes, escaped quotes, and multiline values.
 */
export function parseCSVLines(text: string): string[][] {
  const lines: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;
  let i = 0;

  // Clean BOM if present
  const cleaned = text.replace(/^\uFEFF/, '').trim();

  while (i < cleaned.length) {
    const char = cleaned[i];

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < cleaned.length && cleaned[i + 1] === '"') {
          // Escaped quote
          currentField += '"';
          i += 2;
          continue;
        } else {
          // End of quotes
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        currentField += char;
        i++;
        continue;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
        continue;
      } else if (char === ',') {
        currentRow.push(currentField.trim());
        currentField = '';
        i++;
        continue;
      } else if (char === '\r') {
        if (i + 1 < cleaned.length && cleaned[i + 1] === '\n') {
          i++;
        }
        currentRow.push(currentField.trim());
        if (currentRow.some(f => f.length > 0)) {
          lines.push(currentRow);
        }
        currentRow = [];
        currentField = '';
        i++;
        continue;
      } else if (char === '\n') {
        currentRow.push(currentField.trim());
        if (currentRow.some(f => f.length > 0)) {
          lines.push(currentRow);
        }
        currentRow = [];
        currentField = '';
        i++;
        continue;
      } else {
        currentField += char;
        i++;
        continue;
      }
    }
  }

  // Push remainder
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some(f => f.length > 0)) {
      lines.push(currentRow);
    }
  }

  return lines;
}

export function parseLumaCSV(csvText: string, sortMode: 'chronological' | 'original' = 'chronological'): RawLumaGuest[] {
  const rows = parseCSVLines(csvText);
  if (rows.length === 0) return [];

  const headers = rows[0].map(h => h.trim().toLowerCase());
  
  // Find column indices
  const getIndex = (names: string[]): number => {
    for (const name of names) {
      const idx = headers.findIndex(h => h === name.toLowerCase() || h.includes(name.toLowerCase()));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const idIdx = getIndex(['guest_id', 'id']);
  const nameIdx = getIndex(['name', 'full_name', 'nom']);
  const firstNameIdx = getIndex(['first_name', 'nom']);
  const lastNameIdx = getIndex(['last_name', 'cognoms', 'cognom']);
  const emailIdx = getIndex(['email', 'correu']);
  const phoneIdx = getIndex(['phone_number', 'phone', 'telefon', 'telèfon']);
  const dateIdx = getIndex(['created_at', 'registered_at', 'data']);
  const statusIdx = getIndex(['approval_status', 'status', 'estat']);
  const ticketIdx = getIndex(['ticket_name', 'ticket', 'tipus']);
  const comarcaIdx = getIndex(['comarca']);
  const municipiIdx = getIndex(['municipi', 'ciutat', 'poblacio']);
  const dishIdx = getIndex([
    'dinar - segon plat a escollir (si escau)',
    'dinar - segon plat',
    'segon plat',
    'dish',
    'plat'
  ]);
  const amountIdx = getIndex(['amount', 'import']);
  const currencyIdx = getIndex(['currency', 'moneda']);

  const rawGuests: RawLumaGuest[] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    const guestId = (idIdx >= 0 ? row[idIdx] : '') || `guest-${r}`;
    const fullName = (nameIdx >= 0 ? row[nameIdx] : '') || '';
    const firstName = (firstNameIdx >= 0 ? row[firstNameIdx] : '') || '';
    const lastName = (lastNameIdx >= 0 ? row[lastNameIdx] : '') || '';
    const email = (emailIdx >= 0 ? row[emailIdx] : '') || '';
    const phone = (phoneIdx >= 0 ? row[phoneIdx] : '') || '';
    const createdAt = (dateIdx >= 0 ? row[dateIdx] : '') || new Date().toISOString();
    const status = (statusIdx >= 0 ? row[statusIdx] : '') || 'approved';
    const ticket = (ticketIdx >= 0 ? row[ticketIdx] : '') || '';
    const comarca = (comarcaIdx >= 0 ? row[comarcaIdx] : '') || '';
    const municipi = (municipiIdx >= 0 ? row[municipiIdx] : '') || '';
    const dishRaw = (dishIdx >= 0 ? row[dishIdx] : '') || '';
    const amount = (amountIdx >= 0 ? row[amountIdx] : '') || '';
    const currency = (currencyIdx >= 0 ? row[currencyIdx] : '') || 'eur';

    // Discard empty or corrupt rows
    if (!fullName && !email && !phone) continue;

    let finalFirstName = firstName.trim();
    let finalLastName = lastName.trim();
    let finalFullName = (fullName || `${firstName} ${lastName}`).trim();

    // Check if this guest is "Aliança Catalana Pla d'Urgell"
    const normalizedCheck = finalFullName.toLowerCase().replace(/['\s]/g, '');
    const isAliancaPlaUrgell =
      guestId === 'gst-4EiPYqOwuE90vqE' ||
      (email && email.toLowerCase() === 'pladurgell@aliancacatalana.cat') ||
      normalizedCheck.includes('aliancacatalanapladurgell') ||
      normalizedCheck.includes('aliançacatalanapladurgell');

    if (isAliancaPlaUrgell) {
      finalFullName = 'Manel Solà';
      finalFirstName = 'Manel';
      finalLastName = 'Solà';
    } else if (!finalFirstName && !finalLastName && finalFullName) {
      if (finalFullName.includes(',')) {
        const commaParts = finalFullName.split(',');
        finalLastName = commaParts[0].trim();
        finalFirstName = commaParts.slice(1).join(',').trim();
      } else {
        const spaceParts = finalFullName.split(/\s+/);
        if (spaceParts.length > 1) {
          finalFirstName = spaceParts[0];
          finalLastName = spaceParts.slice(1).join(' ');
        } else {
          finalFirstName = spaceParts[0];
        }
      }
    }

    rawGuests.push({
      guest_id: guestId,
      name: finalFullName,
      first_name: finalFirstName,
      last_name: finalLastName,
      email,
      phone_number: phone,
      created_at: createdAt,
      approval_status: status,
      ticket_name: ticket,
      comarca,
      municipi,
      dish_raw: dishRaw,
      amount,
      currency,
    });
  }

  return rawGuests;
}

export function determineLunchStatus(rawDish: string, ticketName: string): { stays: boolean; cleanDish: string } {
  const d = (rawDish || '').trim();
  const lowerDish = d.toLowerCase();
  const lowerTicket = (ticketName || '').toLowerCase();

  // Explicit decline
  if (lowerDish.includes('no em quedo') || lowerDish.includes('no dinar') || lowerDish === 'no') {
    return { stays: false, cleanDish: 'No em quedo al dinar' };
  }

  // Explicit dishes
  if (lowerDish.includes('carn') || lowerDish.includes('llom')) {
    return { stays: true, cleanDish: 'Carn - Cap de llom' };
  }
  if (lowerDish.includes('peix') || lowerDish.includes('orada')) {
    return { stays: true, cleanDish: 'Peix - Orada' };
  }

  // Any other non-empty dish choice that isn't "no..."
  if (d.length > 0 && !lowerDish.includes('no')) {
    return { stays: true, cleanDish: d };
  }

  // If ticket explicitly says "dinar"
  if (lowerTicket.includes('dinar')) {
    return { stays: true, cleanDish: d || 'Sense plat especificat' };
  }

  // Default: doesn't stay
  return { stays: false, cleanDish: 'No em quedo al dinar' };
}

export function processGuests(
  rawGuests: RawLumaGuest[],
  sortMode: 'chronological' | 'original' = 'chronological',
  tableSize = 10,
  tableAssignments: TableAssignmentsMap = {}
): EventAnalysis {
  // Clone array
  let sorted = [...rawGuests];

  if (sortMode === 'chronological') {
    // Sort oldest created_at first -> chronological order of registration
    sorted.sort((a, b) => {
      const timeA = new Date(a.created_at).getTime();
      const timeB = new Date(b.created_at).getTime();
      if (isNaN(timeA) || isNaN(timeB)) return 0;
      return timeA - timeB; // Earliest first
    });
  }

  const processedAll: ProcessedGuest[] = [];
  const lunchGuests: ProcessedGuest[] = [];
  const noLunchGuests: ProcessedGuest[] = [];

  // Classify guests
  sorted.forEach((raw, idx) => {
    const { stays, cleanDish } = determineLunchStatus(raw.dish_raw, raw.ticket_name);
    const item: ProcessedGuest = {
      ...raw,
      staysForLunch: stays,
      cleanDish,
      registrationOrder: idx + 1,
    };
    processedAll.push(item);
    if (stays) {
      lunchGuests.push(item);
    } else {
      noLunchGuests.push(item);
    }
  });

  // Helper to find assignment by guest_id, email, or name
  const getAssignment = (g: ProcessedGuest) => {
    if (tableAssignments[g.guest_id] !== undefined) return tableAssignments[g.guest_id];
    if (g.email && tableAssignments[g.email] !== undefined) return tableAssignments[g.email];
    if (g.name && tableAssignments[g.name] !== undefined) return tableAssignments[g.name];
    return undefined;
  };

  const hasAnyAssignments = Object.keys(tableAssignments).length > 0;

  // Track assignments: tableNumber -> array of length tableSize with seats 0..9 (seatNumbers 1..10)
  const assignedByTable: Map<number, (ProcessedGuest | null)[]> = new Map();
  const unassignedGuests: ProcessedGuest[] = [];
  const unassignedQueue: ProcessedGuest[] = [];

  if (hasAnyAssignments) {
    // 1. Process guests with explicit assignments
    lunchGuests.forEach(g => {
      const assignment = getAssignment(g);
      if (assignment) {
        if (assignment.tableNumber === null) {
          // Explicitly unassigned
          g.tableNumber = undefined;
          g.seatNumber = undefined;
          unassignedGuests.push(g);
        } else if (typeof assignment.tableNumber === 'number' && assignment.tableNumber > 0) {
          g.tableNumber = assignment.tableNumber;
          g.seatNumber = assignment.seatNumber ?? undefined;

          if (!assignedByTable.has(g.tableNumber)) {
            assignedByTable.set(g.tableNumber, new Array(tableSize).fill(null));
          }
          const tableSeats = assignedByTable.get(g.tableNumber)!;
          if (
            g.seatNumber &&
            g.seatNumber >= 1 &&
            g.seatNumber <= tableSize &&
            tableSeats[g.seatNumber - 1] === null
          ) {
            tableSeats[g.seatNumber - 1] = g;
          } else {
            // Find first free seat in this table
            const freeIdx = tableSeats.findIndex(s => s === null);
            if (freeIdx !== -1) {
              tableSeats[freeIdx] = g;
              g.seatNumber = freeIdx + 1;
            } else {
              tableSeats.push(g);
              g.seatNumber = tableSeats.length;
            }
          }
        }
      } else {
        // No explicit assignment for this guest
        unassignedQueue.push(g);
      }
    });

    // 2. Place any unassignedQueue guests into empty seats of existing tables or next tables
    unassignedQueue.forEach(g => {
      let placed = false;
      const sortedTableNums = Array.from(assignedByTable.keys()).sort((a, b) => a - b);
      for (const tableNum of sortedTableNums) {
        const seats = assignedByTable.get(tableNum)!;
        const freeIdx = seats.findIndex(s => s === null);
        if (freeIdx !== -1) {
          seats[freeIdx] = g;
          g.tableNumber = tableNum;
          g.seatNumber = freeIdx + 1;
          placed = true;
          break;
        }
      }

      if (!placed) {
        const nextTableNum =
          assignedByTable.size > 0 ? Math.max(...Array.from(assignedByTable.keys())) + 1 : 1;
        const newSeats = new Array(tableSize).fill(null);
        newSeats[0] = g;
        g.tableNumber = nextTableNum;
        g.seatNumber = 1;
        assignedByTable.set(nextTableNum, newSeats);
      }
    });
  } else {
    // Default assignment: group into tables of 10
    const totalLunch = lunchGuests.length;
    const numTables = Math.ceil(totalLunch / tableSize) || 0;

    for (let t = 0; t < numTables; t++) {
      const tableNum = t + 1;
      const startIdx = t * tableSize;
      const endIdx = Math.min(startIdx + tableSize, totalLunch);
      const tableMembers = lunchGuests.slice(startIdx, endIdx);
      const seats = new Array(tableSize).fill(null);

      tableMembers.forEach((g, seatIdx) => {
        g.tableNumber = tableNum;
        g.seatNumber = seatIdx + 1;
        seats[seatIdx] = g;
      });

      assignedByTable.set(tableNum, seats);
    }
  }

  // Build final TableGroup array
  const tableNumbers = Array.from(assignedByTable.keys()).sort((a, b) => a - b);
  const tables: TableGroup[] = tableNumbers.map(tableNum => {
    const rawSeats = assignedByTable.get(tableNum) || [];
    const tableGuests = rawSeats.filter((g): g is ProcessedGuest => g !== null);

    const dishCounts: Record<string, number> = {};
    tableGuests.forEach(g => {
      dishCounts[g.cleanDish] = (dishCounts[g.cleanDish] || 0) + 1;
    });

    return {
      tableNumber: tableNum,
      capacity: Math.max(tableSize, rawSeats.length),
      guests: tableGuests,
      dishCounts,
    };
  });

  // Overall dish totals
  const dishCountsMap: Record<string, number> = {};
  lunchGuests.forEach(g => {
    dishCountsMap[g.cleanDish] = (dishCountsMap[g.cleanDish] || 0) + 1;
  });

  const dishTotals: DishTotal[] = Object.entries(dishCountsMap).map(([dish, count]) => ({
    dish,
    count,
    percentage: lunchGuests.length > 0 ? Math.round((count / lunchGuests.length) * 1000) / 10 : 0,
  }));

  dishTotals.sort((a, b) => b.count - a.count);

  return {
    allGuests: processedAll,
    lunchGuests,
    noLunchGuests,
    unassignedGuests,
    tables,
    dishTotals,
    totalRegistered: rawGuests.length,
    totalLunch: lunchGuests.length,
    totalNoLunch: noLunchGuests.length,
    totalTables: tables.length,
    updatedAt: new Date().toISOString(),
  };
}
