
import { Alert, Button, Col, Form, Input, InputNumber, Row } from "antd";
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
      layout="vertical"
      onFinish={onFinish}
      disabled={loading}
      initialValues={initialValues}
    >
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, message: 'Please enter name' }]}
          >
            <Input placeholder="Enter name" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Please enter email' },
              { type: 'email', message: 'Please enter a valid email' }
            ]}
          >
            <Input placeholder="Enter email" />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            name="phone"
            label="Phone"
          >
            <Input placeholder="Enter phone number" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            name="age"
            label="Age"
          >
            <InputNumber 
              style={{ width: '100%' }} 
              min={0} 
              placeholder="Enter age" 
            />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item
        name="address"
        label="Address"
      >
        <Input.TextArea rows={3} placeholder="Enter address" />
      </Form.Item>

      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            name="role"
            label="Role"
          >
            <Input placeholder="e.g. Developer" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            name="department"
            label="Department"
          >
            <Input placeholder="e.g. Engineering" />
          </Form.Item>
        </Col>
      </Row>

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
