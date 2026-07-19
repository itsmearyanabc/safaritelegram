import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { currency } = await request.json();

    if (!['USD', 'EUR'].includes(currency)) {
      return NextResponse.json({ error: 'Invalid currency' }, { status: 400 });
    }

    const wallet = await prisma.wallet.findUnique({
      where: { userId: session.userId }
    });

    if (!wallet) {
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
    }

    // Prevent currency change when balance > 0 to avoid free-money exploit
    // (e.g. $100 USD → €100 EUR without conversion)
    if (Number(wallet.balance) > 0) {
      return NextResponse.json(
        { error: 'Cannot change currency while wallet has a balance. Please withdraw or spend your funds first.' },
        { status: 400 }
      );
    }

    await prisma.wallet.update({
      where: { id: wallet.id },
      data: { currency }
    });

    return NextResponse.json({ success: true, currency });
  } catch (error) {
    console.error('Change currency error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
