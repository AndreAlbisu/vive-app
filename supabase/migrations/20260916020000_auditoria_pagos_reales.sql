-- Solo lectura, continuación de la auditoría previa a la limpieza. No cambia nada.
-- La pregunta que falta responder antes de borrar 183 reservas: ¿alguna movió
-- plata de verdad? La Política de Privacidad §10 dice que las transacciones se
-- conservan 10 años por obligación contable-fiscal, así que si hay pagos reales
-- ahí, esas filas NO se pueden borrar sin decidirlo a conciencia.
do $$
declare r record;
begin
  raise notice '── PAGOS: proveedor / estado ──────────────────────────';
  for r in
    select coalesce(payment_provider, '(sin riel)') as riel,
           coalesce(payment_status, '(sin estado)') as estado,
           count(*) as n,
           sum(coalesce(charged_amount, 0)) as cobrado
      from public.bookings
     group by 1, 2
     order by n desc
  loop
    raise notice '  % / % → % reservas · cobrado %', r.riel, r.estado, r.n, r.cobrado;
  end loop;

  raise notice '';
  raise notice '── Las que tienen identificador de pago del proveedor ──';
  for r in
    select id, payment_provider, payment_status, charged_amount, scheduled_date, paid_out_at
      from public.bookings
     where coalesce(charged_amount, 0) > 0
     order by scheduled_date
     limit 30
  loop
    raise notice '  % · % · % · monto % · fecha % · pagado al coach %',
      left(r.id::text, 8), r.payment_provider, r.payment_status,
      r.charged_amount, r.scheduled_date, coalesce(r.paid_out_at::text, 'no');
  end loop;

  raise notice '';
  raise notice '── ESTADOS de la reserva ──────────────────────────────';
  for r in
    select status, count(*) as n, min(scheduled_date) as desde, max(scheduled_date) as hasta
      from public.bookings group by status order by n desc
  loop
    raise notice '  % → % (del % al %)', r.status, r.n, r.desde, r.hasta;
  end loop;
end $$;
