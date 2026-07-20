garbled_bytes = b'\xc3\xa5\xc2\x8f\xc2\x91\xc3\xa5\xc2\x87\xc2\xba\xc3\xa8\xc2\xae\xc2\xa1\xc3\xa5\xc2\x88\xc2\x92\xc3\xa4\xc2\xb8\xc2\x8e\xc3\xa8\xc2\xaf\xc2\x84\xc3\xa8\xc2\xae\xc2\xa1'
normal_bytes = '发布计划与评审'.encode('utf-8')

print(f"Garbled bytes decoded as UTF-8: {garbled_bytes.decode('utf-8')}")
print(f"Normal bytes decoded as UTF-8: {normal_bytes.decode('utf-8')}")
print(f"Are they equal? {garbled_bytes.decode('utf-8') == normal_bytes.decode('utf-8')}")
print(f"Garbled hex: {garbled_bytes.hex()}")
print(f"Normal hex: {normal_bytes.hex()}")