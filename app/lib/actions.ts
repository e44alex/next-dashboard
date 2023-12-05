'use server';

import { sql } from '@vercel/postgres';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { CreateInvoice, State, UpdateInvoice } from '@/app/lib/zod-schemas';
import { signIn } from '@/auth';
import { AuthError } from 'next-auth';

export async function createInvoice(prevState: State, formData: FormData) {
  try {
    const validatedFields = CreateInvoice.safeParse({
      customerId: formData.get('customerId'),
      amount: Number(formData.get('amount')),
      status: formData.get('status'),
    });

    if (!validatedFields.success) {
      return {
        errors: validatedFields.error.flatten().fieldErrors,
        message: 'Missing Fields. Failed to Create Invoice.',
      };
    }

    const { customerId, amount, status } = validatedFields.data;

    // Test it out:
    const amountInCents = amount * 10;
    const date = new Date().toISOString().split('T')[0];

    await sql`
    INSERT INTO invoices (customer_id, amount, status, date)
    VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
  `;

    // Since you're updating the data displayed in the invoices route, you want to clear this cache and trigger a new request to the server.
    // You can do this with the revalidatePath function from Next.js:
    revalidatePath('/dashboard/invoices');

    //At this point, you also want to redirect the user back to the /dashboard/invoices page.
    // You can do this with the redirect function from Next.js:
    redirect('/dashboard/invoices');
  } catch (e) {
    console.error(e);
    return {
      message: 'Database Error: Failed to Create Invoice.',
    };
  }

}

export async function updateInvoice(id: string, formData: FormData) {
  try {
    const { customerId, amount, status } = UpdateInvoice.parse({
      customerId: formData.get('customerId'),
      amount: Number(formData.get('amount')),
      status: formData.get('status'),
    });

    const amountInCents = amount * 100;

    await sql`
    UPDATE invoices
    SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
    WHERE id = ${id}
  `;

    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
  } catch (e) {
    console.error(e);
    return {
      message: 'Database Error: Failed to Update Invoice.',
    };
  }
}

export async function deleteInvoice(id: string) {
  try {
    await sql`DELETE FROM invoices WHERE id = ${id}`;
    revalidatePath('/dashboard/invoices');
  } catch (e) {
    console.error(e);
    return { message: 'Database error. Failed to Delete Invoice' };
  }

}

export async function authenticate(
  prevState: string | undefined,
  formData: FormData,
) {
  try {
    await signIn('credentials', formData);
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          return 'Invalid credentials.';
        default:
          return 'Something went wrong.';
      }
    }
    throw error;
  }
}
