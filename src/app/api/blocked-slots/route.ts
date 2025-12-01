import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import mongoose from 'mongoose';
import { BlockedSlot } from '@/models/BlockedSlot';

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const all = await BlockedSlot.find({}).lean();
    // Return as map for easier client consumption
    const map: Record<string, any> = {};
    for (const b of all) {
      map[b.slotKey] = { horarioSlot: b.horarioSlot, dayIndex: b.dayIndex, criadoEm: b.criadoEm };
    }
    return NextResponse.json({ success: true, data: map });
  } catch (e:any) {
    console.error('GET /api/blocked-slots error', e);
    return NextResponse.json({ success: false, error: String(e?.message || e) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();
    const { slotKey, horarioSlot, dayIndex } = body || {};
    if (!slotKey || !horarioSlot || typeof dayIndex !== 'number') {
      return NextResponse.json({ success: false, error: 'slotKey, horarioSlot and dayIndex required' }, { status: 400 });
    }
    // Upsert (create if not exists)
    const created = await BlockedSlot.findOneAndUpdate(
      { slotKey },
      { slotKey, horarioSlot, dayIndex },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean() as { slotKey: string; horarioSlot: string; dayIndex: number } | null;
    if (!created) {
      return NextResponse.json({ success: false, error: 'Failed to create blocked slot' }, { status: 500 });
    }
    return NextResponse.json({ success: true, data: { slotKey: created.slotKey, horarioSlot: created.horarioSlot, dayIndex: created.dayIndex } }, { status: 201 });
  } catch (e:any) {
    console.error('POST /api/blocked-slots error', e);
    return NextResponse.json({ success: false, error: String(e?.message || e) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const slotKey = searchParams.get('slotKey');
    if (!slotKey) {
      // also allow body
      try {
        const body = await request.json();
        if (body && body.slotKey) {
          // proceed
        } else {
          return NextResponse.json({ success: false, error: 'slotKey required' }, { status: 400 });
        }
      } catch (e) {
        return NextResponse.json({ success: false, error: 'slotKey required' }, { status: 400 });
      }
    }
    const key = slotKey as string;
    const removed = await BlockedSlot.findOneAndDelete({ slotKey: key });
    if (removed) return NextResponse.json({ success: true });
    return NextResponse.json({ success: false, error: 'not found' }, { status: 404 });
  } catch (e:any) {
    console.error('DELETE /api/blocked-slots error', e);
    return NextResponse.json({ success: false, error: String(e?.message || e) }, { status: 500 });
  }
}
