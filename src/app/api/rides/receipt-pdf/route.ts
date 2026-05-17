import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getAuthClient } from '@/lib/authClient';
import PDFDocument from 'pdfkit';

/**
 * GET /api/rides/receipt-pdf?ride_id=xxx
 * Genera un PDF real del recibo de viaje y lo retorna como descarga
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rideId = searchParams.get('ride_id');

    if (!rideId) {
      return NextResponse.json({ error: 'ride_id es requerido' }, { status: 400 });
    }

    // Auth
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const db = getAuthClient(token);

    // Fetch ride data
    const { data: ride, error: rideError } = await db
      .from('rides')
      .select('*')
      .eq('id', rideId)
      .single();

    if (rideError || !ride) {
      return NextResponse.json({ error: 'Viaje no encontrado' }, { status: 404 });
    }

    // Verify user is the rider or driver
    const isRider = ride.rider_id === user.id;
    let isDriver = false;
    if (ride.driver_id) {
      const { data: driverRecord } = await db
        .from('drivers')
        .select('id')
        .eq('id', ride.driver_id)
        .eq('user_id', user.id)
        .single();
      isDriver = !!driverRecord;
    }
    if (!isRider && !isDriver) {
      return NextResponse.json({ error: 'No tienes permiso para ver este recibo' }, { status: 403 });
    }

    // Fetch driver info
    let driverName = '';
    let driverVehicle = '';
    let driverPlate = '';

    if (ride.driver_id) {
      const { data: d } = await db
        .from('drivers')
        .select('profiles(name), vehicles(model, color, plate)')
        .eq('id', ride.driver_id)
        .single();
      if (d) {
        driverName = (d as any).profiles?.name || '';
        const v = (d as any).vehicles;
        driverVehicle = v ? `${v.model} ${v.color}` : '';
        driverPlate = v?.plate || '';
      }
    }

    // Fetch rider info
    let riderName = '';
    const { data: riderProfile } = await db
      .from('profiles')
      .select('name')
      .eq('id', ride.rider_id)
      .single();
    if (riderProfile) {
      riderName = (riderProfile as any).name || '';
    }

    // Calculate fare breakdown
    const commissionRate = ride.commission_rate || 15;
    const baseFare = Math.round(ride.price * 0.2);
    const distanceFare = ride.price - baseFare;
    const commission = Math.round(ride.price * commissionRate / 100);
    const driverEarnings = ride.price - commission;

    // Check for tip
    const tipAmount = ride.tip_amount || 0;
    const tipMethod = ride.tip_method || '';

    // Generate PDF
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      info: {
        Title: `RIDA Recibo - ${rideId.substring(0, 8).toUpperCase()}`,
        Author: 'RIDA SUPREME SYSTEM',
        Subject: 'Recibo de Viaje',
      },
    });

    // Collect PDF bytes
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));

    const COLORS = {
      primary: '#2563eb',
      dark: '#1a1a2e',
      gray: '#64748b',
      lightGray: '#94a3b8',
      border: '#e2e8f0',
      bg: '#f8fafc',
      green: '#10b981',
      red: '#ef4444',
      amber: '#d97706',
      white: '#ffffff',
    };

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    let y = doc.page.margins.top;

    // ── Header ──
    doc.rect(doc.page.margins.left, y, pageWidth, 90).fill(COLORS.primary);
    doc.fill(COLORS.white);
    doc.fontSize(22).font('Helvetica-Bold').text('RIDA SUPREME', doc.page.margins.left, y + 12, { align: 'center', width: pageWidth });
    doc.fontSize(11).font('Helvetica').text('Recibo de Viaje', doc.page.margins.left, y + 38, { align: 'center', width: pageWidth });
    doc.fontSize(28).font('Helvetica-Bold').text(`\u20A1${ride.price.toLocaleString()}`, doc.page.margins.left, y + 52, { align: 'center', width: pageWidth });
    y += 100;

    // ── Status + ID ──
    const statusText = ride.status === 'completed' ? 'COMPLETADO' : 'CANCELADO';
    const statusColor = ride.status === 'completed' ? COLORS.green : COLORS.red;

    // Status badge
    doc.roundedRect(doc.page.margins.left, y, 100, 22, 11).fill(statusColor);
    doc.fill(COLORS.white).fontSize(9).font('Helvetica-Bold').text(statusText, doc.page.margins.left, y + 6, { width: 100, align: 'center' });

    // ID
    doc.fill(COLORS.lightGray).fontSize(10).font('Helvetica').text(`#${rideId.substring(0, 8).toUpperCase()}`, doc.page.margins.left + pageWidth - 80, y + 6, { width: 80, align: 'right' });

    // Date
    const dateStr = new Date(ride.created_at).toLocaleDateString('es-CR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
    doc.text(dateStr, doc.page.margins.left + pageWidth - 250, y + 6, { width: 160, align: 'right' });
    y += 35;

    // ── Route Section ──
    doc.fill(COLORS.gray).fontSize(10).font('Helvetica-Bold').text('RUTA DEL VIAJE', doc.page.margins.left, y);
    y += 18;

    // Origin
    const circleSize = 8;
    const circleY = y + 3;
    doc.circle(doc.page.margins.left + 6, circleY + circleSize / 2, circleSize / 2).fill(COLORS.green);
    doc.fill(COLORS.lightGray).fontSize(8).text('RECOGIDA', doc.page.margins.left + 20, y);
    doc.fill(COLORS.dark).fontSize(11).font('Helvetica-Bold').text(ride.origin || 'N/A', doc.page.margins.left + 20, y + 10, { width: pageWidth - 30 });
    y += 30;

    // Dashed line
    doc.strokeColor(COLORS.border).lineWidth(1);
    doc.moveTo(doc.page.margins.left + 6, y).lineTo(doc.page.margins.left + 6, y + 18).dash(2, { space: 2 }).stroke();
    doc.undash();
    y += 18;

    // Destination
    doc.circle(doc.page.margins.left + 6, y + 3 + circleSize / 2, circleSize / 2).fill(COLORS.red);
    doc.fill(COLORS.lightGray).fontSize(8).font('Helvetica').text('DESTINO', doc.page.margins.left + 20, y);
    doc.fill(COLORS.dark).fontSize(11).font('Helvetica-Bold').text(ride.destination || 'N/A', doc.page.margins.left + 20, y + 10, { width: pageWidth - 30 });
    y += 32;

    // ── Trip Stats ──
    if (ride.distance || ride.duration) {
      doc.fill(COLORS.gray).fontSize(10).font('Helvetica-Bold').text('DETALLES DEL VIAJE', doc.page.margins.left, y);
      y += 15;

      const stats = [
        { label: 'Distancia', value: `${ride.distance || 0} km` },
        { label: 'Duracion', value: `${ride.duration || 0} min` },
        { label: 'Tipo', value: getTypeLabel(ride.ride_type) },
      ];

      const boxWidth = (pageWidth - 24) / 3;
      stats.forEach((stat, i) => {
        const bx = doc.page.margins.left + i * (boxWidth + 12);
        doc.roundedRect(bx, y, boxWidth, 40, 6).fill(COLORS.bg);
        doc.stroke(COLORS.border).lineWidth(0.5).roundedRect(bx, y, boxWidth, 40, 6).stroke();
        doc.fill(COLORS.dark).fontSize(14).font('Helvetica-Bold').text(stat.value, bx, y + 8, { width: boxWidth, align: 'center' });
        doc.fill(COLORS.lightGray).fontSize(8).text(stat.label, bx, y + 26, { width: boxWidth, align: 'center' });
      });
      y += 52;
    }

    // ── Driver Info ──
    if (driverName) {
      doc.fill(COLORS.gray).fontSize(10).font('Helvetica-Bold').text('CONDUCTOR', doc.page.margins.left, y);
      y += 15;

      doc.roundedRect(doc.page.margins.left, y, pageWidth, 44, 6).fill(COLORS.bg);
      doc.stroke(COLORS.border).lineWidth(0.5).roundedRect(doc.page.margins.left, y, pageWidth, 44, 6).stroke();

      // Driver avatar circle
      doc.circle(doc.page.margins.left + 22, y + 22, 14).fill(COLORS.primary);
      doc.fill(COLORS.white).fontSize(12).font('Helvetica-Bold').text(driverName.charAt(0).toUpperCase(), doc.page.margins.left + 16, y + 15, { width: 14, align: 'center' });

      doc.fill(COLORS.dark).fontSize(11).font('Helvetica-Bold').text(driverName, doc.page.margins.left + 42, y + 10);
      doc.fill(COLORS.gray).fontSize(9).font('Helvetica').text(`${driverVehicle}${driverPlate ? ' | ' + driverPlate : ''}`, doc.page.margins.left + 42, y + 26);
      y += 56;
    }

    // ── Rider Info ──
    if (riderName) {
      doc.fill(COLORS.gray).fontSize(10).font('Helvetica-Bold').text('PASAJERO', doc.page.margins.left, y);
      y += 15;

      doc.roundedRect(doc.page.margins.left, y, pageWidth, 32, 6).fill(COLORS.bg);
      doc.stroke(COLORS.border).lineWidth(0.5).roundedRect(doc.page.margins.left, y, pageWidth, 32, 6).stroke();
      doc.fill(COLORS.dark).fontSize(10).font('Helvetica').text(`Nombre: `, doc.page.margins.left + 12, y + 10, { continued: true });
      doc.font('Helvetica-Bold').text(riderName);
      y += 44;
    }

    // ── Price Breakdown ──
    doc.fill(COLORS.gray).fontSize(10).font('Helvetica-Bold').text('DESGLOSE DEL PRECIO', doc.page.margins.left, y);
    y += 15;

    const breakdownItems = [
      { label: 'Tarifa base', value: `\u20A1${baseFare.toLocaleString()}` },
      { label: 'Tarifa por distancia', value: `\u20A1${distanceFare.toLocaleString()}` },
    ];

    if (ride.surge_multiplier && ride.surge_multiplier > 1) {
      breakdownItems.push({ label: 'Multiplicador de demanda', value: `x${ride.surge_multiplier}`, color: COLORS.amber });
    }

    if (tipAmount > 0) {
      breakdownItems.push({ label: `Propina (${tipMethod === 'cash' ? 'efectivo' : 'billetera'})`, value: `\u20A1${tipAmount.toLocaleString()}`, color: COLORS.green });
    }

    const totalAmount = ride.price + tipAmount;

    breakdownItems.forEach(item => {
      const itemColor = item.color || COLORS.dark;
      doc.fill(itemColor).fontSize(10).font('Helvetica').text(item.label, doc.page.margins.left + 12, y);
      doc.text(item.value, doc.page.margins.left + 12, y, { width: pageWidth - 24, align: 'right' });
      y += 18;
    });

    // Total line
    y += 2;
    doc.moveTo(doc.page.margins.left + 12, y).lineTo(doc.page.margins.left + pageWidth - 12, y).lineWidth(1.5).strokeColor(COLORS.dark).stroke();
    y += 8;
    doc.fill(COLORS.dark).fontSize(16).font('Helvetica-Bold').text('Total', doc.page.margins.left + 12, y);
    doc.text(`\u20A1${totalAmount.toLocaleString()}`, doc.page.margins.left + 12, y, { width: pageWidth - 24, align: 'right' });
    y += 28;

    // ── Payment Method ──
    const paymentMethod = getPaymentLabel(ride.payment_method);
    doc.roundedRect(doc.page.margins.left, y, pageWidth, 36, 6).fill(COLORS.bg);
    doc.stroke(COLORS.border).lineWidth(0.5).roundedRect(doc.page.margins.left, y, pageWidth, 36, 6).stroke();
    doc.fill(COLORS.dark).fontSize(10).font('Helvetica-Bold').text(`Pago: ${paymentMethod}`, doc.page.margins.left + 12, y + 12);
    doc.text(`\u20A1${ride.price.toLocaleString()}`, doc.page.margins.left + 12, y + 12, { width: pageWidth - 24, align: 'right' });
    y += 50;

    // ── Footer ──
    doc.moveTo(doc.page.margins.left, y).lineTo(doc.page.margins.left + pageWidth, y).dash(4, { space: 4 }).lineWidth(0.5).strokeColor(COLORS.border).stroke();
    doc.undash();
    y += 12;
    doc.fill(COLORS.primary).fontSize(11).font('Helvetica-Bold').text('RIDA SUPREME SYSTEM', doc.page.margins.left, y, { align: 'center', width: pageWidth });
    doc.fill(COLORS.lightGray).fontSize(8).font('Helvetica').text('Gracias por viajar con nosotros. Costa Rica', doc.page.margins.left, y + 14, { align: 'center', width: pageWidth });
    doc.text(`Recibo generado: ${new Date().toLocaleDateString('es-CR')}`, doc.page.margins.left, y + 26, { align: 'center', width: pageWidth });

    // Mark receipt as generated
    db.rpc('mark_receipt_generated', { p_ride_id: rideId }).catch(() => {});

    // Finalize
    doc.end();

    // Wait for PDF to be fully generated
    return new Promise<Response>((resolve) => {
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        resolve(
          new Response(pdfBuffer, {
            status: 200,
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': `attachment; filename="RIDA-Recibo-${rideId.substring(0, 8).toUpperCase()}.pdf"`,
              'Content-Length': pdfBuffer.length.toString(),
            },
          })
        );
      });
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al generar PDF';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function getTypeLabel(type: string | null | undefined): string {
  const labels: Record<string, string> = {
    standard: 'Economico', premium: 'Premium', suv: 'SUV',
    moto: 'Moto', moto_express: 'Moto Express', grua: 'Grua', flete: 'Flete',
  };
  return labels[type || 'standard'] || 'Standard';
}

function getPaymentLabel(method: string | null | undefined): string {
  const labels: Record<string, string> = {
    efectivo: 'Efectivo', sinpe: 'SINPE', tarjeta: 'Tarjeta', wallet: 'Billetera RIDA',
  };
  return labels[method || 'efectivo'] || 'Efectivo';
}
