import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);

    // Build filter object
    const filter: Record<string, unknown> = {};

    // Search by name or email (case-insensitive)
    const search = searchParams.get("search");
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    // Filter by phone (case-insensitive partial match)
    const phone = searchParams.get("phone");
    if (phone) {
      filter.phone = { $regex: phone, $options: "i" };
    }

    // Filter by role
    const role = searchParams.get("role");
    if (role) {
      filter.role = role;
    }

    // Filter by department
    const department = searchParams.get("department");
    if (department) {
      filter.department = department;
    }

    // Filter by age range
    const minAge = searchParams.get("minAge");
    const maxAge = searchParams.get("maxAge");
    if (minAge || maxAge) {
      filter.age = {};
      if (minAge) {
        filter.age.$gte = Number(minAge);
      }
      if (maxAge) {
        filter.age.$lte = Number(maxAge);
      }
    }

    const users = await User.find(filter).sort({ createdAt: -1 });
    return NextResponse.json({ users }, { status: 200 });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();
    const { name, email, phone, age, address, role, department } = body;

    if (!name || !email) {
      return NextResponse.json(
        { error: "Name and email are required" },
        { status: 400 }
      );
    }

    const user = await User.create({
      name,
      email,
      phone: phone || undefined,
      age: age ? Number(age) : undefined,
      address: address || undefined,
      role: role || undefined,
      department: department || undefined,
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error: unknown) {
    console.error("Error creating user:", error);
    if (error instanceof Error && error.message.includes("duplicate")) {
      return NextResponse.json(
        { error: "Email already exists" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500 }
    );
  }
}
