import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { Client } from 'pg';

/**
 * POST /api/deploy-rpcs
 * Deploys marketplace RPC functions to Supabase database.
 * Requires SUPABASE_DB_URL in .env (PostgreSQL connection string).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const dbUrl = body.dbUrl || process.env.SUPABASE_DB_URL;

    if (!dbUrl) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Se requiere SUPABASE_DB_URL. Agrega a .env:\nSUPABASE_DB_URL=postgresql://postgres:[PASSWORD]@db.behwnnvrdfrlwnwlfmxt.supabase.co:5432/postgres',
        },
        { status: 400 }
      );
    }

    // Read the SQL file
    const sqlPath = path.join(process.cwd(), 'download', 'deploy-marketplace-rpcs.sql');
    if (!fs.existsSync(sqlPath)) {
      return NextResponse.json(
        { success: false, error: `SQL file not found: ${sqlPath}` },
        { status: 404 }
      );
    }

    const sql = fs.readFileSync(sqlPath, 'utf-8');

    // Connect to the database
    const client = new Client({
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false },
    });

    await client.connect();
    console.log('[deploy-rpcs] Connected to database');

    // Execute the SQL
    const result = await client.query(sql);
    console.log('[deploy-rpcs] SQL executed successfully');

    // Get verification results
    const verifyResult = await client.query(`
      SELECT proname, prosecdef
      FROM pg_proc
      WHERE pronamespace = 'public'::regnamespace
        AND proname IN (
          'get_vendor_products', 'insert_vendor_product', 'update_vendor_product',
          'toggle_vendor_product_stock', 'toggle_vendor_product_featured',
          'delete_vendor_product', 'bulk_insert_vendor_products', 'bulk_vendor_product_action',
          'get_vendor_orders', 'update_vendor_delivery_status', 'get_or_create_vendor'
        )
      ORDER BY proname
    `);

    await client.end();

    return NextResponse.json({
      success: true,
      message: 'RPCs deployed successfully',
      functions: verifyResult.rows.map((r) => r.proname),
      verification: verifyResult.rows,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[deploy-rpcs] Error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * GET /api/deploy-rpcs
 * Returns instructions for deploying RPCs.
 */
export async function GET() {
  return NextResponse.json({
    message: 'Deploy marketplace RPCs to Supabase',
    options: {
      option1: {
        method: 'SQL Editor (recommended)',
        steps: [
          'Go to https://supabase.com/dashboard/project/behwnnvrdfrlwnwlfmxt/sql',
          'Click "New query"',
          'Copy the contents of download/deploy-marketplace-rpcs.sql',
          'Click "Run"',
        ],
      },
      option2: {
        method: 'API endpoint',
        steps: [
          'Add your DB password to .env:',
          'SUPABASE_DB_URL=postgresql://postgres:[PASSWORD]@db.behwnnvrdfrlwnwlfmxt.supabase.co:5432/postgres',
          'Call POST /api/deploy-rpcs with { "dbUrl": "your-db-url" } or rely on env var',
        ],
      },
    },
  });
}
