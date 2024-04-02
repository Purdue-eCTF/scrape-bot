
symtab = currentProgram.getSymbolTable()
exportAddrs = symtab.getExternalEntryPointIterator()
for addr in exportAddrs:
    sym = symtab.getPrimarySymbol(addr)
    if(sym is not None):
        if ("RECEIVE_DONE_REG" in sym.getName()):
            if ("RECEIVE_DONE_REG" == sym.getName()):
                print("FOUND_ADDR_EXACT: " + sym.getAddress().toString())
            else:
                print("FOUND_ADDR[" + sym.getName() + "]: " + sym.getAddress().toString())

