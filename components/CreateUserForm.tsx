
import { Alert, Button, Form, Input, InputNumber } from "antd";
import { useEffect, useState } from "react";

export interface UserFormData {
  name: string;
  email: string;
  phone?: string;
  age?: number;
  address?: string;
  role?: string;
  department?: string;
}

interface UserFormProps {
  initialValues?: UserFormData;
  userId?: string;
  onSuccess: () => void;
  onClose?: () => void;
}

export default function UserForm({
  initialValues,
  userId,
  onSuccess,
  onClose,
}: UserFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [form] = Form.useForm();
  
  const isEdit = !!userId;

  useEffect(() => {
    if (initialValues) {
      form.setFieldsValue(initialValues);
    } else {
      form.resetFields();
    }
  }, [initialValues, form]);

  const onFinish = async (values: any) => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const url = isEdit ? `/api/users/${userId}` : "/api/users";
      const method = isEdit ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Failed to ${isEdit ? "update" : "create"} user`);
      }

      setSuccess(true);
      if (!isEdit) {
        form.resetFields();
      }
      onSuccess();

      setTimeout(() => {
        setSuccess(false);
        if (onClose) {
          onClose();
        }
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form
      form={form}
      onFinish={onFinish}
      disabled={loading}
      initialValues={initialValues}
      className="space-y-4"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Name <span className="text-red-500">*</span>
          </label>
          <Form.Item
            name="name"
            noStyle
            rules={[{ required: true, message: 'Please enter name' }]}
          >
            <Input placeholder="Enter name" className="w-full" />
          </Form.Item>
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Email <span className="text-red-500">*</span>
          </label>
          <Form.Item
            name="email"
            noStyle
            rules={[
              { required: true, message: 'Please enter email' },
              { type: 'email', message: 'Please enter a valid email' }
            ]}
          >
            <Input placeholder="Enter email" className="w-full" />
          </Form.Item>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Phone
          </label>
          <Form.Item name="phone" noStyle>
            <Input placeholder="Enter phone number" className="w-full" />
          </Form.Item>
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Age
          </label>
          <Form.Item name="age" noStyle>
            <InputNumber 
              className="w-full" 
              min={0} 
              placeholder="Enter age" 
            />
          </Form.Item>
        </div>
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">
          Address
        </label>
        <Form.Item name="address" noStyle>
          <Input.TextArea rows={3} placeholder="Enter address" className="w-full" />
        </Form.Item>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Role
          </label>
          <Form.Item name="role" noStyle>
            <Input placeholder="e.g. Developer" className="w-full" />
          </Form.Item>
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Department
          </label>
          <Form.Item name="department" noStyle>
            <Input placeholder="e.g. Engineering" className="w-full" />
          </Form.Item>
        </div>
      </div>

      {error && (
        <Alert
          message={error}
          type="error"
          showIcon
          className="mb-4"
        />
      )}

      {success && (
        <Alert
          message={`User ${isEdit ? "updated" : "created"} successfully!`}
          type="success"
          showIcon
          className="mb-4"
        />
      )}

      <div className="flex gap-3 justify-end">
        {onClose && (
          <Button onClick={onClose} disabled={loading}>
            Cancel
          </Button>
        )}
        <Button type="primary" htmlType="submit" loading={loading}>
          {isEdit ? "Update User" : "Create User"}
        </Button>
      </div>
    </Form>
  );
}
